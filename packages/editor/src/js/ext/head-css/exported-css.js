'use strict';

const ko = require('knockout');
const { descriptorFor } = require('../html-code-block/block-state.js');
const {
  HTML_CODE_BLOCK,
  BLOCK_BUILDER_BLOCK,
} = require('../html-code-block/block-types.js');
const {
  stylesheetForComposedBlocks,
} = require('../../../../../shared/block-builder/block-stylesheet.js');

const isHtmlCodeBlock = (block) => descriptorFor(block) === HTML_CODE_BLOCK;
const isComposedBlock = (block) => descriptorFor(block) === BLOCK_BUILDER_BLOCK;

// Which stylesheet an export carries. TWO sources, and they are gated
// differently because they are different things.
//
// The AUTHOR's CSS follows the HTML code blocks, not the template flag. It
// exists to style markup pasted in one, so while the mailing holds at least
// one it is exported — flag on or off, since turning the flag off keeps
// existing blocks. Once the last one is gone it has nothing left to style.
//
// The DERIVED CSS needs no gate at all, and that is worth saying out loud
// because this file used to refuse it. It is computed from the composed blocks
// in the model, so it cannot exist without one: a mailing with no composed
// block derives an empty string by construction, and there is nothing to
// decide. The comment that used to sit here said the builder "writes its own
// styles inline and has nothing for this stylesheet to style" — true while the
// builder was single-column, and false the moment a column has to stack, since
// a rule inside a media query cannot be inlined by definition.
//
// Derived first, author last: at equal specificity the later rule wins, so a
// hand-written rule can still override a generated one.
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
 * server's findSyntheticBlocks does.
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
 * Every composed block's stored composition, in document order.
 *
 * Walks the model exactly as `hasHtmlCodeBlock` does, so the same containers
 * are looked at and the same Knockout dependencies are registered.
 *
 * @param {Object|Function} content see hasHtmlCodeBlock
 * @returns {Array<string>}
 */
function composedStatesOf(content) {
  const model = unwrap(content);
  if (!model || typeof model !== 'object') return [];

  return Object.keys(model).reduce((states, key) => {
    const blocks = blocksOf(model[key]) || [];
    blocks.forEach((block) => {
      if (!isComposedBlock(block)) return;
      const stored = unwrap(unwrap(block)[BLOCK_BUILDER_BLOCK.stateProperty]);
      if (typeof stored === 'string') states.push(stored);
    });
    return states;
  }, []);
}

/**
 * The stylesheet an export of this content carries.
 *
 * @param {Object|Function} content see hasHtmlCodeBlock
 * @param {string} css the stored head CSS, written by the author
 * @returns {string}
 */
function headCssToExport(content, css) {
  const derived = stylesheetForComposedBlocks(composedStatesOf(content));
  const author =
    typeof css === 'string' && css !== '' && hasHtmlCodeBlock(content)
      ? css
      : '';

  return derived + author;
}

module.exports = {
  hasHtmlCodeBlock,
  headCssToExport,
  composedStatesOf,
};
