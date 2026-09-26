'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger.js');

// Keeps the pasted markup of an "HTML code" block out of the previewHtml
// string-replacement pass.
//
// mailing.data is already safe: `htmlCode` is in EXCLUDED_FIELDS, so the
// extractor never offers it for translation. But previewHtml is translated by
// blind string replacement (preview-html-updater.js), which happily rewrites text
// that happens to sit inside a pasted block. The preview and the multi-mailing ZIP
// (both reading previewHtml) then diverged from the editor export (regenerated
// from data) — two different deliverables for one mailing.
//
// v1 decision: the block is excluded from translation EVERYWHERE. Opt-in
// translation of the block is a v2 idea, out of scope.
//
// Locating a zone, in order of reliability:
//   1. the markup stored in `htmlCode`, when the caller has it: the editor export
//      substitutes it back byte for byte right after the marker element opens, so
//      it can be matched EXACTLY, whatever it contains — an extra `</div>`, a
//      `<div` inside a script string, anything pasted;
//   2. otherwise, depth-counting `<div>` from the marker element, skipping HTML
//      comments so a conditional comment cannot unbalance the count.
//
// Everything here is a linear scan. A regex matching the marker's opening tag
// with a lookahead over its attributes (`<div(?=[^>]*class=...)`) backtracked
// quadratically on crafted input — seconds of blocked event loop per 100KB.

// Keep in sync with packages/editor/src/js/ext/html-code-block/block-types.js.
// Not imported from there: that package is a browser bundle. Enforced by
// tests/editor/html-code-block/constants-sync.test.js.
//
// Both synthetic blocks are protected. The builder's markup carries no ESP
// script to lose, but its zones must be recognised all the same: the zone list
// is what pairs each stored block with its place in previewHtml, and a zone
// missed here would shift every following pairing by one.
const HTML_CODE_MARKER_CLASS = 'lp-html-block';
const BLOCK_BUILDER_MARKER_CLASS = 'lp-builder-block';
const MARKER_CLASSES = [HTML_CODE_MARKER_CLASS, BLOCK_BUILDER_MARKER_CLASS];

// A candidate opening tag longer than this is not LePatron's marker element,
// whose attributes are a class and, at most, an id.
const MAX_TAG_LENGTH = 4096;

// How many of the stored blocks, in order, a zone is compared against.
const EXACT_MATCH_LOOKAHEAD = 8;

const DIV_OPEN = /<div\s/gi;
const DIV_OR_COMMENT = /<!--|-->|<div\b|<\/div\s*>/gi;

/**
 * Whether an opening tag's class list holds the marker class, as a whole token:
 * `lp-html-block-root` (the block root) and `not-lp-html-block-either` are not
 * the marker.
 */
function hasMarkerClass(tag) {
  const classAttr = /\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
  if (!classAttr) return false;
  const classes = (classAttr[1] || classAttr[2] || '').split(/\s+/);
  return MARKER_CLASSES.some((marker) => classes.includes(marker));
}

/**
 * Opening tags of marker elements, in document order: `{ start, contentStart }`.
 *
 * Linear: every candidate `<div ` is read up to the next `>`, and the scan
 * resumes after that `>` — nothing in between can open a real tag, since the
 * serialized template escapes `<` in text. Each character is read once.
 */
function findMarkerTags(html) {
  const tags = [];
  DIV_OPEN.lastIndex = 0;
  let open;
  while ((open = DIV_OPEN.exec(html))) {
    const start = open.index;
    const close = html.indexOf('>', start);
    if (close === -1) break;
    const contentStart = close + 1;
    DIV_OPEN.lastIndex = contentStart;
    if (contentStart - start > MAX_TAG_LENGTH) continue;
    if (hasMarkerClass(html.slice(start, contentStart))) {
      tags.push({ start, contentStart });
    }
  }
  return tags;
}

/**
 * Index just past the `</div>` closing the element whose content starts at
 * `contentStart`, or -1 when the markup is unbalanced.
 */
function findMatchingClose(html, contentStart) {
  DIV_OR_COMMENT.lastIndex = contentStart;
  let depth = 1;
  let inComment = false;
  let token;
  while ((token = DIV_OR_COMMENT.exec(html))) {
    const value = token[0].toLowerCase();
    if (inComment) {
      if (value === '-->') inComment = false;
      continue;
    }
    if (value === '<!--') {
      inComment = true;
    } else if (value === '<div') {
      depth += 1;
    } else if (value.startsWith('</div')) {
      depth -= 1;
      if (depth === 0) return token.index + token[0].length;
    }
  }
  return -1;
}

/**
 * Where the zone opened at `tag` ends, using the stored markup when one of the
 * remaining `htmlCodes` sits exactly at the start of its content. The matched
 * markup is removed from `htmlCodes`, so two identical blocks match in turn.
 */
function exactZoneEnd(html, tag, htmlCodes) {
  // Blocks render in the order they are stored, so the match is almost always
  // the first one left. Looking a few further tolerates a template whose
  // containers render in another order, without comparing every tag against
  // every block.
  const matched = htmlCodes
    .slice(0, EXACT_MATCH_LOOKAHEAD)
    .findIndex((raw) => html.startsWith(raw, tag.contentStart));
  if (matched === -1) return -1;

  const contentEnd = tag.contentStart + htmlCodes[matched].length;
  htmlCodes.splice(matched, 1);

  // The marker element's own closing tag follows the markup.
  const close = /^<\/div\s*>/i.exec(html.slice(contentEnd, contentEnd + 16));
  return close ? contentEnd + close[0].length : contentEnd;
}

/**
 * Ranges of `html` that belong to an HTML code block, as [start, end) pairs
 * covering the marker element and its content.
 *
 * @param {string} html
 * @param {string[]} [htmlCodes] the markup stored in the mailing's HTML code
 *   blocks, in document order. When given, each zone is matched on it exactly.
 * @returns {Array<{start: number, end: number}>}
 */
function findHtmlCodeBlockRanges(html, htmlCodes) {
  const ranges = [];
  if (!html || typeof html !== 'string') return ranges;

  // Empty blocks render no zone at all, and '' would match anywhere.
  const remaining = (htmlCodes || []).filter(
    (raw) => typeof raw === 'string' && raw !== ''
  );

  for (const tag of findMarkerTags(html)) {
    // A marker inside a zone already protected — pasted markup that happens to
    // carry the class — belongs to that zone.
    const previous = ranges[ranges.length - 1];
    if (previous && tag.start < previous.end) continue;

    let end = exactZoneEnd(html, tag, remaining);
    if (end === -1) end = findMatchingClose(html, tag.contentStart);
    if (end === -1) {
      // Unbalanced pasted markup. Protect to the end of the document rather than
      // risk rewriting inside it: a mailing whose tail is left untranslated is a
      // visible, recoverable problem; silently corrupted pasted HTML is not.
      logger.warn(
        '[Translation] unbalanced HTML code block in previewHtml, protecting to end of document'
      );
      ranges.push({ start: tag.start, end: html.length });
      return ranges;
    }
    ranges.push({ start: tag.start, end });
  }
  return ranges;
}

/**
 * Apply `transform` to every part of `html` EXCEPT the HTML code block zones.
 *
 * @param {string} html
 * @param {Function} transform (segment: string) => string
 * @param {string[]} [htmlCodes] see findHtmlCodeBlockRanges
 * @returns {string}
 */
function transformOutsideHtmlCodeBlocks(html, transform, htmlCodes) {
  if (!html || typeof html !== 'string') return html;
  const ranges = findHtmlCodeBlockRanges(html, htmlCodes);
  if (ranges.length === 0) return transform(html);

  let result = '';
  let cursor = 0;
  for (const range of ranges) {
    result += transform(html.slice(cursor, range.start));
    result += html.slice(range.start, range.end);
    cursor = range.end;
  }
  result += transform(html.slice(cursor));
  return result;
}

/**
 * Apply a WHOLE-document transform — the sanitizer — to `html`, and put every
 * HTML code block zone back untouched afterwards.
 *
 * Unlike transformOutsideHtmlCodeBlocks, the transform needs the full document
 * to make sense of it, so each zone is swapped for an inert token first — ASCII,
 * no markup, which a sanitizer keeps as text — then restored. Same technique as
 * the editor export (packages/editor/src/js/ext/html-code-block/
 * export-substitution.js).
 *
 * Why: the translated copy's previewHtml is sanitized before storage, because
 * provider output was injected into it. Sanitizing the pasted markup along with
 * it stripped the ESP scripts the block exists for, and the copy's ZIP no longer
 * matched its export. The zones hold no provider output — they are excluded
 * from translation — and the preview is sanitized again when served.
 *
 * @param {string} html
 * @param {Function} transform (document: string) => string
 * @param {string[]} [htmlCodes] see findHtmlCodeBlockRanges
 * @returns {string}
 */
function transformDocumentKeepingHtmlCodeBlocks(html, transform, htmlCodes) {
  if (!html || typeof html !== 'string') return transform(html);
  const ranges = findHtmlCodeBlockRanges(html, htmlCodes);
  if (ranges.length === 0) return transform(html);

  const nonce = crypto.randomBytes(8).toString('hex');
  const tokenFor = (index) => `LPHTMLBLOCK${nonce}X${index}X`;

  let withTokens = '';
  let cursor = 0;
  ranges.forEach((range, index) => {
    withTokens += html.slice(cursor, range.start) + tokenFor(index);
    cursor = range.end;
  });
  withTokens += html.slice(cursor);

  const transformed = transform(withTokens);
  const pattern = new RegExp(`LPHTMLBLOCK${nonce}X(\\d+)X`, 'g');
  // A replacer function, not a string: pasted markup routinely holds `$&`.
  return transformed.replace(pattern, (match, index) => {
    const range = ranges[Number(index)];
    return range ? html.slice(range.start, range.end) : '';
  });
}

module.exports = {
  transformOutsideHtmlCodeBlocks,
  transformDocumentKeepingHtmlCodeBlocks,
  findHtmlCodeBlockRanges,
  HTML_CODE_MARKER_CLASS,
  BLOCK_BUILDER_MARKER_CLASS,
};
