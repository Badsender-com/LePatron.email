'use strict';

const { BadRequest } = require('http-errors');

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
  parseState,
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

const { type, htmlProperty, stateProperty } = BLOCK_BUILDER_BLOCK;

/**
 * The composed blocks of a content model, walked as the guard walks them.
 * A single block goes through `asModel` (synthetic-block-guard.js) first.
 *
 * @param {Object} data mailing.data
 * @returns {Array<Object>}
 */
const composedBlocksOf = (data) =>
  findSyntheticBlocks(data).filter((block) => block.type === type);

/**
 * The markup a composed block's state generates.
 *
 * @param {Object} block a composed block whose pair is not stored
 * @returns {string}
 * @throws {BadRequest} BLOCK_BUILDER_STATE_UNREADABLE when the block holds
 *   something its state cannot account for
 */
function markupFromState(block) {
  const state = parseState(block[stateProperty]);
  if (state) return generate(state);

  // Nothing to rebuild from, and nothing that would be lost: an empty block,
  // or every element removed in the editor.
  const isEmpty = htmlOf(block) === '' && stateOf(block) === '';
  if (isEmpty || isEmptyComposition(block[stateProperty])) return '';

  logger.warn('Refused a composed block whose state cannot be read', {
    stateLength: stateOf(block).length,
    htmlLength: htmlOf(block).length,
  });
  throw new BadRequest(ERROR_CODES.BLOCK_BUILDER_STATE_UNREADABLE);
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

module.exports = { rebuildComposedMarkup };
