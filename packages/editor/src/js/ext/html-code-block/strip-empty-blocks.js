'use strict';

const { SYNTHETIC_BLOCKS } = require('./block-types.js');

// Removes the leftover root of an EMPTY synthetic block from the exported HTML.
//
// A block with no markup already renders nothing inside itself: its payload sits
// behind the `ko if` that data-ko-display generates. But the block ROOT always
// survives — Mosaico refuses data-ko-display/data-ko-wrap on an element that
// carries data-ko-block, and templateCreator stores that element's outerHTML —
// so an empty block would still ship `<div id="ko_htmlCodeBlock_N"></div>`.
//
// This runs at the very end of the export cascade, on the serialized string, and
// only ever matches an EMPTY root of ours. A block with markup has children at
// that point and is left completely alone. With no synthetic block in the mail
// there is no match at all, so the exported bytes are unchanged.

// An opening <div> carrying our root class, with nothing but whitespace before
// its closing tag. Attribute order is not assumed: `class` comes from the
// injected markup while `id` is added later by Knockout, and browsers serialize
// in insertion order, but a future Mosaico version could add its own attribute
// first.
//
// A linear scan rather than one regex: a lookahead over the attribute list
// (`<div(?=[^>]*class="...")[^>]*>`) backtracks quadratically on a long run of
// unterminated `<div class="`, and this runs on every export, in the browser.
const ROOT_CLASSES = SYNTHETIC_BLOCKS.map((descriptor) => descriptor.rootClass);
const DIV_OPEN = /<div\s/gi;
const EMPTY_CLOSE = /^\s*<\/div>/;

// Longer than this, an opening tag is not the block root, whose attributes are a
// class and an id.
const MAX_TAG_LENGTH = 4096;

// The class is matched as a whole token of the class list, NOT with `\b`: word
// boundaries treat `-` as a separator, so `\blp-html-block-root\b` also matches
// inside `not-lp-html-block-root-either`.
function hasRootClass(tag) {
  const classAttr = /\sclass="([^"]*)"/.exec(tag);
  if (!classAttr) return false;
  const classes = classAttr[1].split(/\s+/);
  return ROOT_CLASSES.some((rootClass) => classes.includes(rootClass));
}

/**
 * @param {string} html serialized export HTML
 * @returns {string}
 */
function stripEmptySyntheticBlocks(html) {
  if (!html || typeof html !== 'string') return html;
  // Nothing to do, and nothing to scan, in a mail without either block.
  if (!ROOT_CLASSES.some((rootClass) => html.indexOf(rootClass) !== -1)) {
    return html;
  }

  let result = '';
  let cursor = 0;
  DIV_OPEN.lastIndex = 0;
  let open;
  while ((open = DIV_OPEN.exec(html))) {
    const start = open.index;
    const close = html.indexOf('>', start);
    if (close === -1) break;
    const tagEnd = close + 1;
    // Nothing between here and that `>` opens a real tag: resume after it.
    DIV_OPEN.lastIndex = tagEnd;
    if (tagEnd - start > MAX_TAG_LENGTH) continue;
    if (!hasRootClass(html.slice(start, tagEnd))) continue;

    const empty = EMPTY_CLOSE.exec(html.slice(tagEnd, tagEnd + MAX_TAG_LENGTH));
    if (!empty) continue;

    result += html.slice(cursor, start);
    cursor = tagEnd + empty[0].length;
    DIV_OPEN.lastIndex = cursor;
  }
  return result + html.slice(cursor);
}

module.exports = { stripEmptySyntheticBlocks };
