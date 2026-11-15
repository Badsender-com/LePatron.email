'use strict';

const {
  BLOCK_BUILDER_BLOCK,
} = require('../../../ext/synthetic-blocks/block-types.js');
const {
  refreshForInsertion,
} = require('../../../../../../shared/block-builder/refresh.js');

// What a saved block becomes in the palette, from the entry the library
// returns. A click or a drag inserts this object as it is (viewmodel.js
// addBlock), so this is where insertion is decided.

const { htmlProperty, stateProperty } = BLOCK_BUILDER_BLOCK;

/**
 * @param {Object} item an entry of `GET /personalized-blocks`
 * @returns {Object} the block to insert, with what the palette shows about
 *   the entry under `blockInformation`
 */
function paletteEntryOf({ content, ...blockInformation }) {
  const entry = {
    ...content,
    blockInformation: {
      // The palette prints the author's name; an entry whose author was
      // deleted comes back without one.
      userDetails: { name: 'admin' },
      ...blockInformation,
    },
    // The editor gives an inserted block its own id. One carried over from
    // the email the block was saved from would be shared by every copy.
    id: '',
  };

  if (entry.type !== BLOCK_BUILDER_BLOCK.type) return entry;

  // A composed block is rendered by the current generator from the moment it
  // is dropped: what the canvas shows is what the save stores (ADR 0026).
  const refreshed = refreshForInsertion({
    builderState: entry[stateProperty],
    builderHtml: entry[htmlProperty],
  });
  entry[stateProperty] = refreshed.builderState;
  entry[htmlProperty] = refreshed.builderHtml;
  return entry;
}

module.exports = { paletteEntryOf };
