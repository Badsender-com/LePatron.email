'use strict';

const { findSyntheticBlocks } = require('./synthetic-block-guard.js');
const {
  HTML_CODE_BLOCK,
  BLOCK_BUILDER_BLOCK,
} = require('../../shared/synthetic-blocks.js');
const {
  exportedHeadCss,
} = require('../../shared/head-css/exported-head-css.js');

// The head CSS a copy the server writes itself must carry — a translated
// duplicate's previewHtml. The rule is the editor's export rule, shared
// (packages/shared/head-css/exported-head-css.js): this module only reads its
// inputs off a plain content model, in one walk.

/**
 * @param {Object} params
 * @param {Object} params.data the content model the copy is rendered from
 * @param {*} params.headCss the head CSS stored on the mailing
 * @returns {string} the stylesheet the copy carries, possibly empty
 */
function headCssToExport({ data, headCss }) {
  const blocks = findSyntheticBlocks(data);

  return exportedHeadCss({
    composedStates: blocks
      .filter((block) => block.type === BLOCK_BUILDER_BLOCK.type)
      .map((block) => block[BLOCK_BUILDER_BLOCK.stateProperty]),
    hasHtmlCodeBlock: blocks.some(
      (block) => block.type === HTML_CODE_BLOCK.type
    ),
    authorCss: headCss,
  });
}

module.exports = { headCssToExport };
