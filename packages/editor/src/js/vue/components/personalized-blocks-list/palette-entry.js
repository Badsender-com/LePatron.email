'use strict';

const {
  BLOCK_BUILDER_BLOCK,
} = require('../../../ext/synthetic-blocks/block-types.js');
const {
  refreshForInsertion,
} = require('../../../../../../shared/block-builder/refresh.js');
const { toPaletteBlock } = require('./palette-block.js');

// What a saved block becomes in the palette, from the entry the library
// returns. A click or a drag inserts this object as it is (viewmodel.js
// addBlock), so this is where insertion is decided.

const { htmlProperty, stateProperty } = BLOCK_BUILDER_BLOCK;

/**
 * @param {Object} item an entry of `GET /personalized-blocks`
 * @returns {Object} the block to insert, with what the palette shows about
 *   the entry under `blockInformation` (palette-block.js)
 */
function paletteEntryOf(item) {
  const entry = toPaletteBlock(item);
  if (entry.type !== BLOCK_BUILDER_BLOCK.type) return entry;

  // A composed block is rendered by the current generator as soon as the list
  // offers it, so what the canvas shows once it is dropped is what the save
  // stores (ADR 0027).
  const refreshed = refreshForInsertion({
    builderState: entry[stateProperty],
    builderHtml: entry[htmlProperty],
  });
  entry[stateProperty] = refreshed.builderState;
  entry[htmlProperty] = refreshed.builderHtml;
  return entry;
}

module.exports = { paletteEntryOf };
