'use strict';

const { isSyntheticBlock } = require('./block-state.js');

// The ways into a synthetic block from the canvas, used by
// block-wysiwyg.tmpl.html.
//
// A synthetic block has nothing to edit in place: its markup is sanitised for
// display and its only setting is a button in the toolbox's Content tab. Mosaico
// switches to that tab on a click only when the click changes the selection
// AND the Blocks tab is showing — but a block dropped from the palette is
// selected without leaving the Blocks tab (viewmodel.js addBlock passes
// `doNotSelect`), so the very next click, the one meant to edit it, changed
// nothing at all. Template blocks keep Mosaico's rule: their text is edited in
// place, and the panel jumping on every click would be noise.

// Order of the tabs in toolbox.tmpl.html: Blocks, Content, Style.
const CONTENT_TOOL = 1;

/**
 * True when the event started on the block's hover toolbar. Its buttons sit
 * inside the block and their clicks bubble to it; they are actions of their
 * own, not a way of opening the block.
 *
 * @param {Event} [evt]
 * @returns {boolean}
 */
function startedOnToolbar(evt) {
  const target = evt && evt.target;
  return Boolean(
    target && typeof target.closest === 'function' && target.closest('.tools')
  );
}

/**
 * @param {Object} vm the editor view-model
 */
function addCanvasEntryToViewModel(vm) {
  // Both synthetic blocks: the pasted one is in the same spot as the composed
  // one, a block whose settings are a single button the user cannot see.
  vm.revealBlockSettings = function (block, evt) {
    if (!isSyntheticBlock(block) || startedOnToolbar(evt)) return;
    vm.selectedTool(CONTENT_TOOL);
  };
}

module.exports = { addCanvasEntryToViewModel, CONTENT_TOOL };
