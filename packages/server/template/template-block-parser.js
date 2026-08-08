'use strict';

const crypto = require('crypto');

const FIELD_ATTRIBUTES = ['data-ko-editable', 'data-ko-link'];

// Some content attributes — a link's URL, an image's alt text — aren't
// declared via a dedicated data-ko-* HTML attribute. Templates bind them
// through a `-ko-attr-<name>: @propertyPath` pseudo-property embedded in the
// element's `style` attribute instead (Mosaico's LESS-based authoring
// syntax — see TEMPLATE_DEVELOPER_GUIDE.md's "HTML Attribute Bindings").
// Only content-relevant attribute names are considered here; style/layout
// ones (width, padding, class, align, ...) bound the same way are
// intentionally excluded — they aren't content a feed item could fill in.
const KO_ATTR_CONTENT_NAMES = ['href', 'alt', 'src'];
const KO_ATTR_BINDING_PATTERN = new RegExp(
  `-ko-attr-(?:${KO_ATTR_CONTENT_NAMES.join(
    '|'
  )})\\s*:\\s*@\\[?\\(?\\s*([A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*)\\s*\\)?\\]?`,
  'g'
);

// HTML void elements: they never have children, so they must not be pushed
// onto the block stack (there is no matching close tag to pop them).
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

// Elements whose text content is CDATA-like and may legitimately contain `<`
// and `>` that are NOT markup (notably <style>, which in these templates holds
// a huge `@supports -ko-blockdefs { ... }` block). We skip straight to the
// matching close tag rather than tokenising their contents.
const RAWTEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title']);

// Matches one HTML tag. The attribute part tolerates quoted values that may
// themselves contain `>` (e.g. style="... a > b ..."). Not a general HTML
// parser — just enough to walk element boundaries and read attributes without
// ever materialising a DOM (cheerio.load on a 10 MB template costs ~1.7s and
// ~500 MB RSS, which OOM-kills small instances; this scan is ~50x cheaper).
const TAG_PATTERN = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/g;

// Matches one attribute (quoted or unquoted value, or valueless).
const ATTR_PATTERN = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

// Parsing is expensive, and the mapping-config UI can request the same
// template repeatedly (reopening the modal, several rows for one template),
// so we memoize the fully-derived result keyed by a content hash — an edited
// template re-parses on its own because its hash changes.
const CACHE_MAX_ENTRIES = 50;
// Map keeps insertion order, which we use for a trivial LRU eviction.
const parseCache = new Map();

function hashMarkup(markup) {
  return crypto.createHash('sha1').update(markup).digest('hex');
}

function readAttributes(attrString) {
  const attrs = {};
  if (!attrString) return attrs;
  ATTR_PATTERN.lastIndex = 0;
  let match;
  while ((match = ATTR_PATTERN.exec(attrString))) {
    const name = match[1].toLowerCase();
    // Value is whichever of the double-quoted / single-quoted / unquoted
    // capture groups matched; valueless attributes get an empty string.
    const value =
      match[3] !== undefined
        ? match[3]
        : match[4] !== undefined
        ? match[4]
        : match[5] !== undefined
        ? match[5]
        : '';
    attrs[name] = value;
    // Guard against a zero-width match looping forever on odd input.
    if (match.index === ATTR_PATTERN.lastIndex) ATTR_PATTERN.lastIndex += 1;
  }
  return attrs;
}

/**
 * Parse a template's markup once and derive, for every block it contains, the
 * distinct field paths bound inside it. Result shape:
 *   { blockNames: string[], fieldsByBlock: { [blockName]: string[] } }
 *
 * Implemented as a single streaming pass over HTML tags (no DOM): a stack
 * tracks the nearest enclosing `data-ko-block` so each field is attributed to
 * the same block cheerio's `.closest('[data-ko-block]')` would have picked.
 * Fields from every rendered variant are collected (e.g. per-market fragments
 * toggled by `data-ko-display`) since those paths are exactly the properties
 * Mosaico instantiates on the block object regardless of which is visible.
 *
 * The result is memoized by markup content hash.
 * @param {string} markup
 * @returns {{ blockNames: string[], fieldsByBlock: Object<string, string[]> }}
 */
function parseTemplateBlocks(markup) {
  if (!markup || typeof markup !== 'string') {
    return { blockNames: [], fieldsByBlock: {} };
  }

  const cacheKey = hashMarkup(markup);
  const cached = parseCache.get(cacheKey);
  if (cached) {
    // Touch for LRU: re-insert so it becomes the most-recently-used entry.
    parseCache.delete(cacheKey);
    parseCache.set(cacheKey, cached);
    return cached;
  }

  const blockNames = [];
  const seenBlocks = new Set();
  const fieldSetsByBlock = new Map();

  const fieldSetFor = (blockName) => {
    if (!seenBlocks.has(blockName)) {
      seenBlocks.add(blockName);
      blockNames.push(blockName);
      fieldSetsByBlock.set(blockName, new Set());
    }
    return fieldSetsByBlock.get(blockName);
  };

  const collectFields = (blockName, attrs) => {
    const fields = fieldSetFor(blockName);
    FIELD_ATTRIBUTES.forEach((attribute) => {
      const fieldPath = attrs[attribute];
      if (fieldPath) fields.add(fieldPath);
    });
    const style = attrs.style;
    if (style) {
      KO_ATTR_BINDING_PATTERN.lastIndex = 0;
      let match;
      while ((match = KO_ATTR_BINDING_PATTERN.exec(style))) {
        fields.add(match[1]);
      }
    }
  };

  // Stack of the enclosing block for each currently-open element. The top is
  // the nearest `data-ko-block` ancestor (null when outside any block).
  const blockStack = [];
  const currentBlock = () =>
    blockStack.length ? blockStack[blockStack.length - 1] : null;

  TAG_PATTERN.lastIndex = 0;
  let tag;
  while ((tag = TAG_PATTERN.exec(markup))) {
    const isClosing = tag[1] === '/';
    const tagName = tag[2].toLowerCase();
    const attrString = tag[3] || '';
    const selfClosed = tag[4] === '/';

    if (isClosing) {
      if (blockStack.length) blockStack.pop();
      continue;
    }

    const attrs = readAttributes(attrString);
    const ownBlock = attrs['data-ko-block'];
    if (ownBlock) fieldSetFor(ownBlock);

    // The block this element belongs to: itself if it declares data-ko-block,
    // otherwise its nearest ancestor block.
    const elementBlock = ownBlock || currentBlock();
    if (elementBlock) collectFields(elementBlock, attrs);

    // Void / self-closed elements have no matching close tag, so they don't
    // affect the stack. Rawtext elements (style/script/...) can contain markup-
    // like characters in their body; skip to their close tag.
    if (VOID_ELEMENTS.has(tagName) || selfClosed) continue;

    if (RAWTEXT_ELEMENTS.has(tagName)) {
      const closePattern = new RegExp(`</${tagName}\\s*>`, 'ig');
      closePattern.lastIndex = TAG_PATTERN.lastIndex;
      const close = closePattern.exec(markup);
      // Resume tokenising right after the close tag (or at EOF if unterminated).
      TAG_PATTERN.lastIndex = close ? closePattern.lastIndex : markup.length;
      continue;
    }

    blockStack.push(elementBlock);
  }

  const fieldsByBlock = {};
  fieldSetsByBlock.forEach((set, blockName) => {
    fieldsByBlock[blockName] = Array.from(set);
  });

  const result = { blockNames, fieldsByBlock };

  parseCache.set(cacheKey, result);
  if (parseCache.size > CACHE_MAX_ENTRIES) {
    // Evict least-recently-used (first key in insertion order).
    const oldestKey = parseCache.keys().next().value;
    parseCache.delete(oldestKey);
  }

  return result;
}

/**
 * List distinct block names (`data-ko-block` values) present in a template's markup.
 * @param {string} markup
 * @returns {string[]}
 */
function listBlockNames(markup) {
  return parseTemplateBlocks(markup).blockNames;
}

/**
 * List distinct field paths (`data-ko-editable`/`data-ko-link` values, plus
 * href/alt/src bound via `-ko-attr-*` style pseudo-properties) found anywhere
 * inside the given block — across every rendered variant, e.g. white-label
 * brand fragments toggled by `data-ko-display` — since these paths are exactly
 * the property names Mosaico instantiates on a block object, regardless of
 * which variant is actually visible.
 * @param {string} markup
 * @param {string} blockName
 * @returns {string[]}
 */
function getBlockFieldPaths(markup, blockName) {
  if (!blockName) return [];
  return parseTemplateBlocks(markup).fieldsByBlock[blockName] || [];
}

module.exports = {
  parseTemplateBlocks,
  listBlockNames,
  getBlockFieldPaths,
};
