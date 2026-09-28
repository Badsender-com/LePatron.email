'use strict';

// Taking the user to a block of the email: shared by the comments panel and the
// quality drawer, which both list things that live in a block.

// Knockout needs a tick to render the selection before the canvas can scroll.
const SCROLL_DELAY_MS = 100;

const unwrap = (value) => (typeof value === 'function' ? value() : value);

/**
 * The block of the content model with this id, or null.
 * @param {Object} viewModel
 * @param {string} blockId
 * @returns {Object|null}
 */
function findBlockById(viewModel, blockId) {
  if (!blockId) return null;
  try {
    const blocks = viewModel.content().mainBlocks().blocks();
    for (let i = 0; i < blocks.length; i++) {
      const block = unwrap(blocks[i]);
      if (block && unwrap(block.id) === blockId) return block;
    }
  } catch (e) {
    // A model being rebuilt has no blocks to find.
  }
  return null;
}

/**
 * The block's element on the canvas, or null.
 * @param {string} blockId
 * @returns {Element|null}
 */
function findBlockElement(blockId) {
  if (!blockId) return null;
  const escaped = window.CSS && CSS.escape ? CSS.escape(blockId) : blockId;
  return document.querySelector(`.editable[data-block-id="${escaped}"]`);
}

/**
 * Selects the block and scrolls the canvas to it.
 * @param {Object} viewModel
 * @param {string} blockId
 * @param {Function} [onScrolled] - receives the block element once shown
 * @returns {boolean} false when the block no longer exists
 */
function goToBlock(viewModel, blockId, onScrolled) {
  const block = findBlockById(viewModel, blockId);
  if (!block) return false;

  viewModel.selectBlock(block, true);
  setTimeout(() => {
    const element = findBlockElement(blockId);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (onScrolled) onScrolled(element);
  }, SCROLL_DELAY_MS);
  return true;
}

module.exports = { findBlockById, findBlockElement, goToBlock };
