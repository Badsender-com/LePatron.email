'use strict';

const ko = require('knockout');
const { BLOCK_BUILDER_BLOCK } = require('./block-types.js');
const { isSyntheticBlock, isComposedBlock } = require('./block-state.js');

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
//
// The composed block also opens from the canvas, by double click or from its
// hover toolbar. The HTML code block does not: it has no such entry point yet,
// and adding one is a separate decision.

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

  // The same predicate as the panel's button (vm.canComposeBlocks, in
  // badsender-widget-block-builder.js): with it off the block is kept but can
  // no longer be edited, so the toolbar offers nothing to open.
  vm.canComposeBlock = function (block) {
    return (
      isComposedBlock(block) &&
      typeof vm.canComposeBlocks === 'function' &&
      vm.canComposeBlocks()
    );
  };

  // Through vm.openBlockBuilder, exactly as the panel's button: one way into
  // the modal, so its guards (the flag, a mounted modal, the accessors) cannot
  // differ between entry points. In the canvas the block is the binding
  // context the panel hands to its widget, so the accessor is the same one.
  vm.composeBlock = function (block) {
    if (!isComposedBlock(block)) return;
    vm.openBlockBuilder(BLOCK_BUILDER_BLOCK.htmlProperty, ko.unwrap(block));
  };

  // A double click lands after the two clicks that already selected the block
  // and revealed its settings; it goes one step further and opens the builder.
  // Returns true so the browser's own double-click behaviour is left alone.
  vm.openBlockFromCanvas = function (block, evt) {
    if (!startedOnToolbar(evt)) vm.composeBlock(block);
    return true;
  };
}

module.exports = { addCanvasEntryToViewModel, CONTENT_TOOL };
