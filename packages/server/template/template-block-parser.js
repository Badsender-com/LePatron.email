'use strict';

const crypto = require('crypto');
const cheerio = require('cheerio');

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

// Parsing a template's markup with cheerio is expensive — a single large
// template measured at ~2s per cheerio.load(), and this app runs on small
// (single-core) instances. The mapping-config UI hits these helpers
// repeatedly (once for the block list, once per block for its fields, and
// again every time the modal is re-opened), so without memoization a handful
// of concurrent calls saturate the event loop and requests start timing out
// (504) or never get served at all. We parse each distinct markup exactly
// once and cache the fully-derived result (block names + every block's field
// paths), keyed by a content hash so an edited template re-parses on its own.
const CACHE_MAX_ENTRIES = 50;
// Map keeps insertion order, which we use for a trivial LRU eviction.
const parseCache = new Map();

function hashMarkup(markup) {
  return crypto.createHash('sha1').update(markup).digest('hex');
}

/**
 * Parse a template's markup once and derive, for every block it contains, the
 * distinct field paths bound inside it. Result shape:
 *   { blockNames: string[], fieldsByBlock: { [blockName]: string[] } }
 * The result is memoized by markup content hash — callers may invoke this on
 * the same markup many times per request cycle without re-paying the parse.
 * @param {string} markup
 * @returns {{ blockNames: string[], fieldsByBlock: Object<string, string[]> }}
 */
function parseTemplateBlocks(markup) {
  const empty = { blockNames: [], fieldsByBlock: {} };
  if (!markup || typeof markup !== 'string') return empty;

  const cacheKey = hashMarkup(markup);
  const cached = parseCache.get(cacheKey);
  if (cached) {
    // Touch for LRU: re-insert so it becomes the most-recently-used entry.
    parseCache.delete(cacheKey);
    parseCache.set(cacheKey, cached);
    return cached;
  }

  const $ = cheerio.load(markup);

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

  // Register every block up front so blocks with no mappable field still
  // appear in the list (matches the previous listBlockNames behaviour).
  $('[data-ko-block]').each((_, element) => {
    const blockName = $(element).attr('data-ko-block');
    if (blockName) fieldSetFor(blockName);
  });

  // Single pass over the elements that can carry a field binding, attributing
  // each to its enclosing block via one upward `.closest()` walk per element.
  const bindingSelector = FIELD_ATTRIBUTES.map((attr) => `[${attr}]`)
    .concat('[style]')
    .join(',');

  $(bindingSelector).each((_, element) => {
    const $el = $(element);
    const blockName = $el.closest('[data-ko-block]').attr('data-ko-block');
    if (!blockName) return;
    const fields = fieldSetFor(blockName);

    FIELD_ATTRIBUTES.forEach((attribute) => {
      const fieldPath = $el.attr(attribute);
      if (fieldPath) fields.add(fieldPath);
    });

    const style = $el.attr('style');
    if (style) {
      KO_ATTR_BINDING_PATTERN.lastIndex = 0;
      let match;
      while ((match = KO_ATTR_BINDING_PATTERN.exec(style))) {
        fields.add(match[1]);
      }
    }
  });

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
