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

const { htmlProperty, stateProperty, originProperty } = BLOCK_BUILDER_BLOCK;

/**
 * @param {Object} item an entry of `GET /personalized-blocks`
 * @returns {Object} the block to insert, with what the palette shows about
 *   the entry under `blockInformation`
 */
function paletteEntryOf({ content, _id, name, category, userDetails }) {
  const entry = {
    ...content,
    // Only what the palette and the save and delete modals read: the first
    // save stores it in the email with the block (ADR 0027).
    blockInformation: {
      _id,
      name,
      category,
      // The palette prints the author's name; an entry whose author was
      // deleted comes back without one.
      userDetails: { name: (userDetails && userDetails.name) || 'admin' },
    },
    // The editor gives an inserted block its own id. One carried over from
    // the email the block was saved from would be shared by every copy.
    id: '',
  };

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
  // The entry it comes from, kept on the block itself (ADR 0027). Stored and
  // never shown: shown before synchronisation exists, it would read as a live
  // link.
  entry[originProperty] = String(blockInformation._id);
  return entry;
}

module.exports = { paletteEntryOf };
