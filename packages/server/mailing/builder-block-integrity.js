'use strict';

const { BLOCK_BUILDER_BLOCK } = require('../../shared/synthetic-blocks.js');
const { parseState } = require('../../shared/block-builder/state.js');
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

const { type, htmlProperty, stateProperty } = BLOCK_BUILDER_BLOCK;

const asString = (value) => (typeof value === 'string' ? value : '');

// One key for the pair: a NUL never appears in either half.
const pairOf = (block) =>
  `${asString(block[htmlProperty])}\u0000${asString(block[stateProperty])}`;

/**
 * The composed blocks of a content model (top-level containers only, as the
 * guard walks them) or of a single block.
 *
 * @param {Object} data mailing.data, or one block
 * @returns {Array<Object>}
 */
function composedBlocksOf(data) {
  if (!data || typeof data !== 'object') return [];
  if (data.type === type) return [data];

  return Object.values(data)
    .filter((value) => value && Array.isArray(value.blocks))
    .reduce(
      (found, value) =>
        found.concat(
          value.blocks.filter(
            (block) => block && typeof block === 'object' && block.type === type
          )
        ),
      []
    );
}

/**
 * Rewrites, in place, the markup of every composed block of `data` whose
 * markup-and-state pair is not already stored in `previousData`.
 *
 * @param {Object} data the content about to be written (mailing.data, or one
 *   personalized block)
 * @param {Object} [previousData] the content currently stored, same shape
 * @returns {number} how many blocks were rebuilt
 */
function rebuildComposedMarkup(data, previousData) {
  const stored = new Set(composedBlocksOf(previousData).map(pairOf));

  return composedBlocksOf(data).reduce((rebuilt, block) => {
    if (stored.has(pairOf(block))) return rebuilt;

    const state = parseState(block[stateProperty]);
    const html = state ? generate(state) : '';
    if (html === block[htmlProperty]) return rebuilt;

    block[htmlProperty] = html;
    return rebuilt + 1;
  }, 0);
}

module.exports = { rebuildComposedMarkup, pairOf };
