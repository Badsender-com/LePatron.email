'use strict';

// Taking the user to a block of the email: shared by the comments panel and the
// quality drawer, which both list things that live in a block.

// Knockout needs a tick to render the selection before the canvas can scroll.
const SCROLL_DELAY_MS = 100;

const unwrap = (value) => (typeof value === 'function' ? value() : value);
// Read without making the caller depend on it: a computed looking for one
// block need not follow every field of the content.
const peek = (value) =>
  typeof value === 'function' && typeof value.peek === 'function'
    ? value.peek()
    : unwrap(value);

// A field of the content that holds a block alone (a header): an object with
// an id and a type. A field being rebuilt is no block.
function singleBlock(field) {
  try {
    const value = peek(field);
    return value && typeof value === 'object' && value.id && value.type
      ? value
      : null;
  } catch (e) {
    return null;
  }
}

/**
 * The block of the content model with this id, or null. Every container of
 * the template is searched (`mainBlocks`, `headerBlocks`…), as the quality
 * engine judges them all (quality/context.js), and the blocks a template
 * holds alone, out of any list (a header, a footer).
 * @param {Object} viewModel
 * @param {string} blockId
 * @returns {Object|null}
 */
function findBlockById(viewModel, blockId) {
  if (!blockId) return null;
  try {
    const content = viewModel.content();
    const keys = Object.keys(content);
    for (const key of keys.filter((name) => !/Blocks$/.test(name))) {
      const single = singleBlock(content[key]);
      if (single && unwrap(single.id) === blockId) return single;
    }
    const containers = keys.filter((key) => /Blocks$/.test(key));
    for (const key of containers) {
      const container = unwrap(content[key]);
      const blocks = (container && unwrap(container.blocks)) || [];
      for (let i = 0; i < blocks.length; i++) {
        const block = unwrap(blocks[i]);
        if (block && unwrap(block.id) === blockId) return block;
      }
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
 * @param {Function} [onMissing] - called when the block exists in the model
 *   but has no element on the canvas once selected (a template being rebuilt)
 * @returns {boolean} false when the block no longer exists
 */
function goToBlock(viewModel, blockId, onScrolled, onMissing) {
  const block = findBlockById(viewModel, blockId);
  if (!block) return false;

  viewModel.selectBlock(block, true);
  setTimeout(() => {
    const element = findBlockElement(blockId);
    if (!element) {
      if (onMissing) onMissing();
      return;
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (onScrolled) onScrolled(element);
  }, SCROLL_DELAY_MS);
  return true;
}

module.exports = { findBlockById, findBlockElement, goToBlock };
