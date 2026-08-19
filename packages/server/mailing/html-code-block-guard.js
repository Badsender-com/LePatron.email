'use strict';

// Server-side size guard for "HTML code" blocks.
//
// The editor already refuses to apply an oversized paste, but `mailing.data` is
// an unvalidated Mixed field, the body parser accepts 50MB, and `previewHtml`
// stores the rendered copy in the same document. Without this check a crafted or
// scripted request could push the document past Mongo's 16MB limit, which would
// surface as a raw Mongo error on save.

// Keep in sync with packages/editor/src/js/ext/html-code-block/constants.js.
// Not imported from there: the editor package is a browser bundle, and the
// server must not depend on it.
const HTML_CODE_BLOCK_TYPE = 'htmlCodeBlock';
const HTML_CODE_PROPERTY = 'htmlCode';
const HTML_CODE_MAX_LENGTH = 100000;

/**
 * Length of the longest HTML code block in a Mosaico content model, or 0.
 *
 * Only walks `mainBlocks.blocks`, the single list Mosaico stores blocks in, so a
 * deeply nested Mixed payload cannot make this expensive.
 *
 * @param {Object} data mailing.data
 * @returns {number}
 */
function findLongestHtmlCodeBlock(data) {
  const blocks =
    data && data.mainBlocks && Array.isArray(data.mainBlocks.blocks)
      ? data.mainBlocks.blocks
      : [];

  return blocks.reduce((longest, block) => {
    if (!block || block.type !== HTML_CODE_BLOCK_TYPE) return longest;
    const html = block[HTML_CODE_PROPERTY];
    const length = typeof html === 'string' ? html.length : 0;
    return Math.max(longest, length);
  }, 0);
}

/**
 * @param {Object} data mailing.data
 * @param {number} [maxLength]
 * @returns {{ valid: boolean, length: number, maxLength: number }}
 */
function validateHtmlCodeBlocks(data, maxLength) {
  const limit =
    typeof maxLength === 'number' ? maxLength : HTML_CODE_MAX_LENGTH;
  const length = findLongestHtmlCodeBlock(data);
  return { valid: length <= limit, length, maxLength: limit };
}

module.exports = {
  validateHtmlCodeBlocks,
  findLongestHtmlCodeBlock,
  HTML_CODE_MAX_LENGTH,
  HTML_CODE_BLOCK_TYPE,
  HTML_CODE_PROPERTY,
};
