'use strict';

// Renders the real block-wysiwyg.tmpl.html — the wrapper every block gets in the
// canvas, its click handlers and its hover toolbar — around a list of blocks,
// with the view-model pieces that template reaches for. Whatever is not under
// test is stubbed; the block builder's own pieces are the production ones, so
// a click goes all the way to `vm.toggleBlockBuilderModal`.

const fs = require('fs');
const path = require('path');
const ko = require('knockout');

const widgetBlockBuilder = require('../../../packages/editor/src/js/ext/badsender-widget-block-builder.js');
const {
  addCanvasEntryToViewModel,
} = require('../../../packages/editor/src/js/ext/html-code-block/canvas-entry.js');
const blockState = require('../../../packages/editor/src/js/ext/html-code-block/block-state.js');

const TEMPLATE = fs.readFileSync(
  path.join(
    __dirname,
    '../../../packages/editor/src/tmpl/block-wysiwyg.tmpl.html'
  ),
  'utf8'
);

// Editor bindings the wrapper uses and that are not under test.
['tooltips', 'scrollIntoView', 'block'].forEach((name) => {
  ko.bindingHandlers[name] = { init() {} };
});
ko.virtualElements.allowedBindings.block = true;

const composedBlock = (html = '<p>composed</p>') =>
  ko.observable({
    id: ko.observable('ko_blockBuilderBlock_1'),
    type: ko.observable('blockBuilderBlock'),
    builderHtml: ko.observable(html),
    builderState: ko.observable('{"v":1}'),
  });

const htmlCodeBlock = () =>
  ko.observable({
    id: ko.observable('ko_htmlCodeBlock_1'),
    type: ko.observable('htmlCodeBlock'),
    htmlCode: ko.observable('<p>pasted</p>'),
  });

const textBlock = () =>
  ko.observable({
    id: ko.observable('ko_textBlock_1'),
    type: ko.observable('textBlock'),
    text: ko.observable('<p>text</p>'),
  });

function createViewModel(metadata) {
  const vm = {
    metadata,
    t: (key) => key,
    // an unrestricted role: these tests are about the tools, not the RBAC
    currentUser: () => ({
      canEditStructure: true,
      canEditContent: true,
      canEditStyle: true,
    }),
    selectedTool: ko.observable(0),
    selectedBlock: ko.observable(null),
    selectBlock: jest.fn((block) => vm.selectedBlock(block)),
    isSyntheticBlock: blockState.isSyntheticBlock,
    isEmptyHtmlBlock: blockState.isEmptySyntheticBlock,
    emptyBlockLabelKey: blockState.emptyLabelKeyFor,
    isFeedMappableBlock: () => false,
    moveBlock: jest.fn(),
    duplicateBlock: jest.fn(),
    saveBlock: jest.fn(),
    commentBlock: jest.fn(),
    removeBlock: jest.fn(),
  };
  widgetBlockBuilder().viewModel(vm);
  addCanvasEntryToViewModel(vm);
  vm.toggleBlockBuilderModal = jest.fn();
  return vm;
}

/**
 * @param {Array<Function>} blocks observable blocks, as Mosaico holds them
 * @param {Object} [metadata] the template flags
 */
function renderCanvas(blocks, metadata = { blockBuilderEnabled: true }) {
  const vm = createViewModel(metadata);
  // `$root` is the view-model and `$parent` the block list, as in the editor,
  // where the toolbar's tools read both.
  vm.list = { blocks: ko.observableArray(blocks) };
  const host = document.createElement('div');
  host.innerHTML = `<div data-bind="with: list"><div data-bind="foreach: blocks">${TEMPLATE}</div></div>`;
  document.body.appendChild(host);
  ko.applyBindings(vm, host);

  const wrappers = Array.from(host.querySelectorAll('.editable.block'));
  return { vm, host, wrappers };
}

function dispatch(element, type) {
  element.dispatchEvent(
    new window.MouseEvent(type, { bubbles: true, cancelable: true })
  );
}

module.exports = {
  TEMPLATE,
  composedBlock,
  htmlCodeBlock,
  textBlock,
  createViewModel,
  renderCanvas,
  dispatch,
};
