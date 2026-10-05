'use strict';

const { BadRequest } = require('http-errors');

const {
  hasSyntheticBlock,
  validateSyntheticBlocks,
  assertSyntheticHtmlAllowed,
} = require('./synthetic-block-guard.js');
const { rebuildComposedMarkup } = require('./builder-block-integrity.js');

// What every write of synthetic content goes through: the mailing save
// (mailing.controller.js updateMosaico) and the personalized blocks
// (personalized-blocks/personalized-block-service.js). Two writes, one
// sequence, so a gate added to one cannot be forgotten in the other — a gate
// missing from either is a gate anyone can walk around.
//
// The order matters:
// 1. the sizes, on what the request sent, so the rebuild never runs on
//    oversized input;
// 2. each composed block's markup rebuilt from its state
//    (builder-block-integrity.js);
// 3. the sizes again, on what was rebuilt — what will actually be stored;
// 4. the template flags, judged on that same stored content.

/**
 * @param {Object} data a content model
 * @throws {BadRequest} the too-large code naming the refused block
 */
function assertSizes(data) {
  const check = validateSyntheticBlocks(data);
  if (!check.valid) throw new BadRequest(check.errorCode);
}

/**
 * Brings the synthetic blocks of a content model to what will be stored, and
 * refuses what may not be.
 *
 * @param {Object} params
 * @param {Object} params.data the content model about to be written; its
 *   composed blocks' markup is rewritten in place
 * @param {Object} [params.previousData] the content model currently stored
 * @param {Function} params.loadFlags resolves with the template flags, by
 *   name; called only when `data` holds a synthetic block, so a write without
 *   any costs no query
 * @throws {BadRequest} HTML_CODE_BLOCK_TOO_LARGE or BLOCK_BUILDER_TOO_LARGE
 * @throws {Forbidden} HTML_CODE_BLOCK_DISABLED or BLOCK_BUILDER_DISABLED
 */
async function normalizeAndGuardSyntheticContent({
  data,
  previousData,
  loadFlags,
}) {
  if (!hasSyntheticBlock(data)) return;

  assertSizes(data);
  rebuildComposedMarkup(data, previousData);
  assertSizes(data);

  const flags = await loadFlags();
  assertSyntheticHtmlAllowed({ data, previousData, flags: flags || {} });
}

module.exports = { normalizeAndGuardSyntheticContent };
