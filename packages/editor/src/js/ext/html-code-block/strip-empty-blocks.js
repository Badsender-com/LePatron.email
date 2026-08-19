'use strict';

const { HTML_CODE_ROOT_CLASS } = require('./constants.js');

// Removes the leftover root of an EMPTY "HTML code" block from the exported HTML.
//
// A block with no markup already renders nothing inside itself: its payload sits
// behind the `ko if` that data-ko-display generates. But the block ROOT always
// survives — Mosaico refuses data-ko-display/data-ko-wrap on an element that
// carries data-ko-block, and templateCreator stores that element's outerHTML —
// so an empty block would still ship `<div id="ko_htmlCodeBlock_N"></div>`.
//
// This runs at the very end of the export cascade, on the serialized string, and
// only ever matches an EMPTY root of ours. A block with pasted markup has
// children at that point and is left completely alone. With no HTML code block in
// the mail there is no match at all, so the exported bytes are unchanged.

// An opening <div> carrying our root class, with no content before its closing
// tag. Attribute order is not assumed: `class` comes from the injected markup
// while `id` is added later by Knockout, and browsers serialize in insertion
// order, but a future Mosaico version could add its own attribute first.
//
// The class name is delimited on whitespace, NOT with `\b`: regex word
// boundaries treat `-` as a separator, so `\blp-html-block-root\b` also matches
// inside `not-lp-html-block-root-either`.
const EMPTY_ROOT = new RegExp(
  '<div(?=[^>]*\\bclass="(?:[^"]*\\s)?' +
    HTML_CODE_ROOT_CLASS +
    '(?:\\s[^"]*)?")[^>]*>\\s*</div>',
  'g'
);

/**
 * @param {string} html serialized export HTML
 * @returns {string}
 */
function stripEmptyHtmlCodeBlocks(html) {
  if (!html || typeof html !== 'string') return html;
  return html.replace(EMPTY_ROOT, '');
}

module.exports = { stripEmptyHtmlCodeBlocks };
