'use strict';

const { BadRequest, Forbidden } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');
const logger = require('../utils/logger.js');
const { BLOCK_BUILDER_BLOCK } = require('../../shared/synthetic-blocks.js');
const {
  findSyntheticBlocks,
  pairKeyOf,
  htmlOf,
  stateOf,
} = require('./synthetic-block-guard.js');
const {
  readState,
  isEmptyComposition,
} = require('../../shared/block-builder/state.js');
const { generate } = require('../../shared/block-builder/generate.js');

// A composed block stores two things: its state, and the markup the editor
// generated from it. The export ships the markup. Whatever escaping the
// generator applies only holds if the stored markup really is what the
// generator makes of the stored state — so the server makes sure of it rather
// than taking the editor's word.
//
// A block whose pair is already stored on the mailing, byte for byte, is left
// alone: it was checked when it was written, and regenerating it with a newer
// generator would change a validated email behind its author's back (the modal
// warns about that, and only rebuilds on Apply). Any other pair has its markup
// rebuilt from its state, with the same shared generator the editor runs — an
// honest editor therefore sends exactly what is rebuilt.
//
// A state that cannot be read — corrupt, or written by a newer version — is
// refused rather than rebuilt into nothing: emptied, the block would be saved
// empty by the next autosave, and the composition lost for good.

const { type, flag, htmlProperty, stateProperty } = BLOCK_BUILDER_BLOCK;

/**
 * The composed blocks of a content model, walked as the guard walks them.
 * A single block goes through `asModel` (synthetic-block-guard.js) first.
 *
 * @param {Object} data mailing.data
 * @returns {Array<Object>}
 */
const composedBlocksOf = (data) =>
  findSyntheticBlocks(data).filter((block) => block.type === type);

// Nothing to rebuild from, and nothing that would be lost: an empty block, or
// every element removed in the editor.
const unreadable = (block, { state, empty }) =>
  !state && !empty && !(htmlOf(block) === '' && stateOf(block) === '');

/**
 * Whether a composed block holds something its state cannot account for —
 * corrupt, or written by a newer version. An empty block, or one whose every
 * element was removed in the editor, has nothing to rebuild from and nothing
 * to lose, and is readable.
 *
 * @param {Object} block a composed block
 * @returns {boolean}
 */
function isUnreadableComposition(block) {
  return unreadable(block, readState(block[stateProperty]));
}

/**
 * The markup a composed block's state generates.
 *
 * @param {Object} block a composed block whose pair is not stored
 * @returns {string}
 * @throws {BadRequest} BLOCK_BUILDER_STATE_UNREADABLE when the block holds
 *   something its state cannot account for
 */
function markupFromState(block) {
  const read = readState(block[stateProperty]);
  if (read.state) return generate(read.state);
  if (!unreadable(block, read)) return '';

  logger.warn('Refused a composed block whose state cannot be read', {
    stateLength: stateOf(block).length,
    htmlLength: htmlOf(block).length,
  });
  throw new BadRequest(ERROR_CODES.BLOCK_BUILDER_STATE_UNREADABLE);
}

/**
 * Whether a composed block holds nothing to rebuild: an empty pair, or a state
 * that is an empty composition. Rebuilt, such a block is empty markup; any
 * other block rebuilds into markup, or is refused as unreadable.
 *
 * @param {Object} block
 * @returns {boolean}
 */
const rebuildsIntoNothing = (block) =>
  (htmlOf(block) === '' && stateOf(block) === '') ||
  isEmptyComposition(block[stateProperty]);

/**
 * Throws when the template does not allow composed blocks and `data` brings one
 * that would be rebuilt into markup.
 *
 * Judged BEFORE anything is rebuilt, so a template without the builder never
 * runs it. It refuses what the flag check on the rebuilt content refuses
 * (synthetic-block-guard.js), no more: a block whose pair is already stored is
 * left alone, and a block that rebuilds into nothing is accepted.
 *
 * @param {Object} params
 * @param {Object} params.data the content model about to be written
 * @param {Object} [params.previousData] the content model currently stored
 * @param {Object} params.flags the template flags, by name
 * @throws {Forbidden} BLOCK_BUILDER_DISABLED
 */
function assertComposedBlocksAllowed({ data, previousData, flags }) {
  if (flags && flags[flag]) return;

  const stored = new Set(composedBlocksOf(previousData).map(pairKeyOf));
  const refused = composedBlocksOf(data).some(
    (block) => !stored.has(pairKeyOf(block)) && !rebuildsIntoNothing(block)
  );
  if (refused) throw new Forbidden(ERROR_CODES.BLOCK_BUILDER_DISABLED);
}

/**
 * Rewrites, in place, the markup of every composed block of `data` whose
 * markup-and-state pair is not already stored in `previousData`.
 *
 * @param {Object} data the content model about to be written
 * @param {Object} [previousData] the content model currently stored
 * @returns {number} how many blocks were rebuilt
 * @throws {BadRequest} BLOCK_BUILDER_STATE_UNREADABLE, see markupFromState
 */
function rebuildComposedMarkup(data, previousData) {
  const stored = new Set(composedBlocksOf(previousData).map(pairKeyOf));

  return composedBlocksOf(data).reduce((rebuilt, block) => {
    if (stored.has(pairKeyOf(block))) return rebuilt;

    const html = markupFromState(block);
    if (html === block[htmlProperty]) return rebuilt;

    block[htmlProperty] = html;
    return rebuilt + 1;
  }, 0);
}

module.exports = {
  rebuildComposedMarkup,
  assertComposedBlocksAllowed,
  isUnreadableComposition,
};
