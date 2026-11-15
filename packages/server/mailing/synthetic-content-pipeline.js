'use strict';

const { BadRequest } = require('http-errors');

const {
  hasSyntheticBlock,
  assertSyntheticHtmlAllowed,
  assertMayCompose,
} = require('./synthetic-block-guard.js');
const { validateSyntheticBlocks } = require('./synthetic-block-sizes.js');
const {
  rebuildComposedMarkup,
  assertComposedBlocksAllowed,
} = require('./builder-block-integrity.js');

// What every write of synthetic content goes through: the mailing save
// (mailing.controller.js updateMosaico) and the personalized blocks
// (personalized-blocks/personalized-block-service.js). Two writes, one
// sequence, so a gate added to one cannot be forgotten in the other — a gate
// missing from either is a gate anyone can walk around.
//
// The order matters:
// 1. the sizes, each block's and their sum (synthetic-block-sizes.js), on what
//    the request sent, so the rebuild never runs on oversized input;
// 2. the builder flag, so the rebuild never runs for a template without the
//    builder (builder-block-integrity.js);
// 3. each composed block's markup rebuilt from its state
//    (builder-block-integrity.js);
// 4. the sizes again, on what was rebuilt — what will actually be stored;
// 5. the template flags, judged on that same stored content;
// 6. the right to compose, judged the same way (ADR 0027). After the flags, so
//    a template that does not allow the builder says so, whoever is saving.

/**
 * @param {Object} data a content model
 * @throws {BadRequest} the too-large code naming the refused block, or the
 *   whole content
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
 * @param {boolean} params.mayCompose whether the author holds `block.compose`;
 *   anything but `true` refuses a new or changed composed block
 * @throws {BadRequest} HTML_CODE_BLOCK_TOO_LARGE, BLOCK_BUILDER_TOO_LARGE or
 *   SYNTHETIC_CONTENT_TOO_LARGE
 * @throws {Forbidden} HTML_CODE_BLOCK_DISABLED, BLOCK_BUILDER_DISABLED or
 *   BLOCK_BUILDER_NOT_PERMITTED
 */
async function normalizeAndGuardSyntheticContent({
  data,
  previousData,
  loadFlags,
  mayCompose,
}) {
  if (!hasSyntheticBlock(data)) return;

  assertSizes(data);

  const flags = (await loadFlags()) || {};
  assertComposedBlocksAllowed({ data, previousData, flags });

  rebuildComposedMarkup(data, previousData);
  assertSizes(data);

  assertSyntheticHtmlAllowed({ data, previousData, flags });
  assertMayCompose({ data, previousData, mayCompose });
}

module.exports = { normalizeAndGuardSyntheticContent };
