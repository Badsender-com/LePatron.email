'use strict';

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
// The zone is located by depth-counting `<div>` from the marker element, skipping
// HTML comments so a conditional comment inside the pasted markup cannot unbalance
// the count.

// Keep in sync with packages/editor/src/js/ext/html-code-block/constants.js.
// Not imported from there: that package is a browser bundle.
const HTML_CODE_MARKER_CLASS = 'lp-html-block';

// The marker element's opening tag. The class name is delimited on whitespace,
// NOT with `\b`: word boundaries treat `-` as a separator, so `\blp-html-block\b`
// would also match the block ROOT's `lp-html-block-root`.
const MARKER_OPEN = new RegExp(
  '<div(?=[^>]*\\bclass="(?:[^"]*\\s)?' +
    HTML_CODE_MARKER_CLASS +
    '(?:\\s[^"]*)?")[^>]*>',
  'gi'
);

const DIV_OR_COMMENT = /<!--|-->|<div\b|<\/div\s*>/gi;

/**
 * Ranges of `html` that belong to an HTML code block, as [start, end) pairs
 * covering the marker element and its content.
 *
 * @param {string} html
 * @returns {Array<{start: number, end: number}>}
 */
function findHtmlCodeBlockRanges(html) {
  const ranges = [];
  if (!html || typeof html !== 'string') return ranges;

  MARKER_OPEN.lastIndex = 0;
  let open;
  while ((open = MARKER_OPEN.exec(html))) {
    const contentStart = open.index + open[0].length;
    const end = findMatchingClose(html, contentStart);
    if (end === -1) {
      // Unbalanced pasted markup. Protect to the end of the document rather than
      // risk rewriting inside it: a mailing whose tail is left untranslated is a
      // visible, recoverable problem; silently corrupted pasted HTML is not.
      logger.warn(
        '[Translation] unbalanced HTML code block in previewHtml, protecting to end of document'
      );
      ranges.push({ start: open.index, end: html.length });
      return ranges;
    }
    ranges.push({ start: open.index, end });
    // Resume after this zone so a nested marker cannot be matched twice.
    MARKER_OPEN.lastIndex = end;
  }
  return ranges;
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
 * Apply `transform` to every part of `html` EXCEPT the HTML code block zones.
 *
 * @param {string} html
 * @param {Function} transform (segment: string) => string
 * @returns {string}
 */
function transformOutsideHtmlCodeBlocks(html, transform) {
  if (!html || typeof html !== 'string') return html;
  const ranges = findHtmlCodeBlockRanges(html);
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

module.exports = {
  transformOutsideHtmlCodeBlocks,
  findHtmlCodeBlockRanges,
  HTML_CODE_MARKER_CLASS,
};
