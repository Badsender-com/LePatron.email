'use strict';

const ERROR_CODES = require('../constant/error-codes.js');
const {
  findSyntheticBlocks,
  descriptorOf,
  htmlOf,
  stateOf,
  HTML_CODE_MAX_LENGTH,
  BUILDER_STATE_MAX_LENGTH,
  SYNTHETIC_CONTENT_MAX_LENGTH,
} = require('./synthetic-block-guard.js');

// How large the synthetic blocks of a content model may be.
//
// The editor already refuses to apply an oversized paste or composition, but
// `mailing.data` is an unvalidated Mixed field, the body parser accepts 50MB,
// and `previewHtml` stores the rendered copy in the same document. Without
// these checks a crafted or scripted request could push the document past
// Mongo's 16MB limit, which would surface as a raw Mongo error on save.
//
// Each block is bounded, and so is their sum: nothing else limits how many
// blocks a request brings.

/**
 * The descriptor of the first synthetic block past a size limit, or null.
 *
 * The markup is bounded for every block; the builder's state too, since it
 * sits in the same document and nothing else bounds it.
 *
 * @param {Object} data mailing.data
 * @param {Object} [limits]
 * @param {number} [limits.html] maximum markup length
 * @param {number} [limits.state] maximum serialised state length
 * @returns {Object|null}
 */
function findOversizedSyntheticBlock(data, limits) {
  const { html = HTML_CODE_MAX_LENGTH, state = BUILDER_STATE_MAX_LENGTH } =
    limits || {};
  const oversized = findSyntheticBlocks(data).find(
    (block) => htmlOf(block).length > html || stateOf(block).length > state
  );
  return oversized ? descriptorOf(oversized) : null;
}

/**
 * The markup and state every synthetic block of a content model holds, in
 * characters, added up.
 *
 * @param {Object} data mailing.data
 * @returns {number}
 */
function syntheticContentLength(data) {
  return findSyntheticBlocks(data).reduce(
    (total, block) => total + htmlOf(block).length + stateOf(block).length,
    0
  );
}

/**
 * @param {Object} data mailing.data
 * @param {number} [maxLength] maximum markup length of one block
 * @returns {{ valid: boolean, errorCode: string|null }} `errorCode` names the
 *   refused block — its markup or, for the builder, its state — or the
 *   content as a whole when only the sum is past its bound.
 */
function validateSyntheticBlocks(data, maxLength) {
  const limit =
    typeof maxLength === 'number' ? maxLength : HTML_CODE_MAX_LENGTH;
  const refused = findOversizedSyntheticBlock(data, { html: limit });
  if (refused) return { valid: false, errorCode: refused.tooLargeErrorCode };

  // After the per-block bounds, which name the block to shorten: only when
  // every block fits does the sum have something to add.
  if (syntheticContentLength(data) > SYNTHETIC_CONTENT_MAX_LENGTH) {
    return {
      valid: false,
      errorCode: ERROR_CODES.SYNTHETIC_CONTENT_TOO_LARGE,
    };
  }
  return { valid: true, errorCode: null };
}

module.exports = {
  findOversizedSyntheticBlock,
  syntheticContentLength,
  validateSyntheticBlocks,
};
