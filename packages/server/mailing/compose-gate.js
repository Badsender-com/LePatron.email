'use strict';

const { Forbidden } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');
const { BLOCK_BUILDER_BLOCK } = require('../../shared/synthetic-blocks.js');
const {
  findSyntheticBlocks,
  pairKeyOf,
  htmlOf,
} = require('./synthetic-block-guard.js');

/**
 * Throws when `data` brings a composition its author may not write: a composed
 * block that is new or changed, from someone without `block.compose` (ADR 0027).
 *
 * Judged like the template flag, on the stored pair: a composed block whose
 * markup and state are already stored in the email passes, so moving,
 * duplicating and deleting composed blocks, and saving an email whose composed
 * blocks nobody touched, stay open to whoever may save the email. An empty
 * composed block renders and exports nothing, and passes too.
 *
 * The pair holds the texts as well, so a changed text counts as a composition
 * until inline editing tells the two apart (ADR 0027).
 *
 * Nothing is granted by default: anything but an explicit `true` refuses.
 *
 * @param {Object} params
 * @param {Object} params.data the content about to be written
 * @param {Object} [params.previousData] the content currently stored
 * @param {boolean} params.mayCompose whether the author holds the capability
 * @throws {Forbidden} BLOCK_BUILDER_NOT_PERMITTED
 */
function assertMayCompose({ data, previousData, mayCompose }) {
  if (mayCompose === true) return;

  const composedOf = (content) =>
    findSyntheticBlocks(content).filter(
      (block) => block.type === BLOCK_BUILDER_BLOCK.type
    );
  const stored = new Set(composedOf(previousData).map(pairKeyOf));

  const brought = composedOf(data).some(
    (block) => htmlOf(block) !== '' && !stored.has(pairKeyOf(block))
  );
  if (brought) throw new Forbidden(ERROR_CODES.BLOCK_BUILDER_NOT_PERMITTED);
}

module.exports = { assertMayCompose };
