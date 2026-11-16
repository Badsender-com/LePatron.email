'use strict';

// The author of a block saved by the account defined in the environment
// variables is no stored user: the list carries no `userDetails` for it.
const UNSTORED_AUTHOR_NAME = 'admin';

/**
 * Turns an entry of the saved blocks list into a block of the palette.
 *
 * `blockInformation` keeps only what the palette and the save and delete
 * modals read. A stored author's name is printed as stored, or nothing when
 * the user has none.
 *
 * @param {Object} entry - an item of GET /personalized-blocks
 * @returns {Object} the block the palette shows and drops into the email
 */
function toPaletteBlock({ content, _id, name, category, userDetails }) {
  return {
    ...content,
    blockInformation: {
      _id,
      name,
      category,
      userDetails: {
        name: userDetails ? userDetails.name || '' : UNSTORED_AUTHOR_NAME,
      },
    },
    // `viewModel.loadDefaultBlocks` replaces this id when the block is added
    // to the email content; without the placeholder, adding the block fails.
    id: '',
  };
}

module.exports = { toPaletteBlock, UNSTORED_AUTHOR_NAME };
