'use strict';

const ko = require('knockout');
const { isHtmlCodeBlock } = require('../html-code-block/block-state.js');

// Which head CSS an export carries. The rule: the CSS follows the HTML code
// blocks, not the template flag.
//
// The stylesheet exists to style markup pasted in an HTML code block. While the
// mailing holds at least one, the CSS is exported — whether the flag is on or
// off, since turning the flag off keeps existing blocks (and the server keeps
// accepting them). Once the last block is gone, the CSS has nothing left to
// style and is left out of the export, but it stays in `viewModel.headCss` and
// on the mailing: an undo, or a block added back, gets it back as it was.
//
// The server applies the same rule to the copies it writes itself
// (packages/server/mailing/head-css-guard.js, headCssToExport). Both walk the
// content model the same way, which tests/editor/head-css/exported-css.test.js
// pins on a shared fixture.

const unwrap = (value) => ko.utils.unwrapObservable(value);

/**
 * The blocks of a top-level container, or null for anything that is not one.
 *
 * @param {*} value a top-level property of the content model, wrapped or not
 * @returns {Array|null}
 */
function blocksOf(value) {
  const container = unwrap(value);
  if (!container || typeof container !== 'object') return null;
  const blocks = unwrap(container.blocks);
  return Array.isArray(blocks) ? blocks : null;
}

/**
 * Whether a Mosaico content model holds an HTML code block, empty or not.
 *
 * Every top-level `{ blocks: [...] }` container is looked at — `mainBlocks` by
 * convention, but a template may declare others — and only that level, as the
 * server's findHtmlCodeBlocks does.
 *
 * Works on the plain model as on the instrumented one. Read inside a Knockout
 * computed or binding, it subscribes to the containers and blocks it reads, so
 * adding, removing or undoing a block re-evaluates it.
 *
 * @param {Object|Function} content `viewModel.content`, or a plain model
 * @returns {boolean}
 */
function hasHtmlCodeBlock(content) {
  const model = unwrap(content);
  if (!model || typeof model !== 'object') return false;

  return Object.keys(model).some((key) => {
    const blocks = blocksOf(model[key]);
    return Boolean(blocks) && blocks.some(isHtmlCodeBlock);
  });
}

/**
 * The CSS an export of this content carries: the stored CSS while an HTML code
 * block is present, nothing otherwise.
 *
 * @param {Object|Function} content see hasHtmlCodeBlock
 * @param {string} css the stored head CSS
 * @returns {string}
 */
function headCssToExport(content, css) {
  if (typeof css !== 'string' || css === '') return '';
  return hasHtmlCodeBlock(content) ? css : '';
}

module.exports = { hasHtmlCodeBlock, headCssToExport };
