'use strict';

const ko = require('knockout');
const { descriptorFor } = require('../synthetic-blocks/block-state.js');
const {
  HTML_CODE_BLOCK,
  BLOCK_BUILDER_BLOCK,
} = require('../synthetic-blocks/block-types.js');
const {
  exportedHeadCss,
} = require('../../../../../shared/head-css/exported-head-css.js');

// Which stylesheet an export carries, read off the editor's content model.
//
// The rule itself is shared with the server
// (packages/shared/head-css/exported-head-css.js), which says why the derived
// stylesheet needs no gate, why the author's follows the HTML code blocks, and
// in what order they go. This module only collects the inputs from the
// Knockout model, in one walk; the server collects the same ones from a plain
// model (packages/server/mailing/head-css-export.js), and
// tests/editor/head-css/exported-css.test.js pins the two to agree.

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
 * Every synthetic block of a Mosaico content model, in document order, with
 * its descriptor.
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
 * @returns {Array<{descriptor: Object, block: Object}>} each block unwrapped,
 *   its properties left as they are
 */
function syntheticBlocksOf(content) {
  const model = unwrap(content);
  if (!model || typeof model !== 'object') return [];

  return Object.keys(model).reduce((found, key) => {
    (blocksOf(model[key]) || []).forEach((block) => {
      const descriptor = descriptorFor(block);
      if (descriptor) found.push({ descriptor, block: unwrap(block) });
    });
    return found;
  }, []);
}

const isHtmlCodeBlock = ({ descriptor }) => descriptor === HTML_CODE_BLOCK;

/**
 * Whether a Mosaico content model holds an HTML code block, empty or not.
 *
 * @param {Object|Function} content see syntheticBlocksOf
 * @returns {boolean}
 */
function hasHtmlCodeBlock(content) {
  return syntheticBlocksOf(content).some(isHtmlCodeBlock);
}

/**
 * The stylesheet an export of this content carries.
 *
 * @param {Object|Function} content see syntheticBlocksOf
 * @param {string} css the stored head CSS, written by the author
 * @returns {string}
 */
function headCssToExport(content, css) {
  const blocks = syntheticBlocksOf(content);

  return exportedHeadCss({
    composedStates: blocks
      .filter(({ descriptor }) => descriptor === BLOCK_BUILDER_BLOCK)
      .map(({ block }) => unwrap(block[BLOCK_BUILDER_BLOCK.stateProperty])),
    hasHtmlCodeBlock: blocks.some(isHtmlCodeBlock),
    authorCss: css,
  });
}

module.exports = {
  hasHtmlCodeBlock,
  headCssToExport,
};
