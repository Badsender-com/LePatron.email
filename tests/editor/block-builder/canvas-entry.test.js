/**
 * @jest-environment jsdom
 */

'use strict';

// From the canvas, a click on a synthetic block has to land on its settings.
// Mosaico only switches to the Content tab when a click changes the selection,
// and a block dropped from the palette is already selected — so the click meant
// to edit it did nothing, and the user had to find the Content tab themselves.

const {
  CONTENT_TOOL,
} = require('../../../packages/editor/src/js/ext/synthetic-blocks/canvas-entry.js');
const {
  TEMPLATE,
  composedBlock,
  htmlCodeBlock,
  textBlock,
  createViewModel,
  renderCanvas,
  dispatch,
} = require('./canvas-helpers.js');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('revealing a synthetic block settings', () => {
  it.each([0, 2])('switches to the Content tab from tab %i', (tab) => {
    const vm = createViewModel({ blockBuilderEnabled: true });
    vm.selectedTool(tab);
    vm.revealBlockSettings(composedBlock());
    expect(vm.selectedTool()).toBe(CONTENT_TOOL);
  });

  it('does the same for the HTML code block', () => {
    const vm = createViewModel({});
    vm.revealBlockSettings(htmlCodeBlock());
    expect(vm.selectedTool()).toBe(CONTENT_TOOL);
  });

  // Template blocks are edited in place; their panel keeps Mosaico's rule.
  it('leaves a template block to Mosaico', () => {
    const vm = createViewModel({ blockBuilderEnabled: true });
    vm.selectedTool(2);
    vm.revealBlockSettings(textBlock());
    expect(vm.selectedTool()).toBe(2);
  });

  it('ignores a click that started on the hover toolbar', () => {
    const vm = createViewModel({ blockBuilderEnabled: true });
    const tools = document.createElement('div');
    tools.className = 'tools';
    const icon = document.createElement('span');
    tools.appendChild(icon);
    vm.revealBlockSettings(composedBlock(), { target: icon });
    expect(vm.selectedTool()).toBe(0);
  });
});

describe('clicking a block in the canvas', () => {
  it('runs the reveal after Mosaico selection, on the block wrapper', () => {
    expect(TEMPLATE).toContain(
      '$root.selectBlock(obj); $root.revealBlockSettings(obj, evt); return true'
    );
  });

  it('selects an already selected composed block and shows its settings', () => {
    const block = composedBlock();
    const { vm, wrappers } = renderCanvas([block]);
    // As addBlock leaves it: selected, Blocks tab still showing.
    vm.selectedBlock(block());

    dispatch(wrappers[0], 'click');

    expect(vm.selectBlock).toHaveBeenCalledWith(block());
    expect(vm.selectedTool()).toBe(CONTENT_TOOL);
  });

  it('keeps the tab as it is for a template block', () => {
    const { vm, wrappers } = renderCanvas([textBlock()]);
    dispatch(wrappers[0], 'click');
    expect(vm.selectBlock).toHaveBeenCalled();
    expect(vm.selectedTool()).toBe(0);
  });

  it('keeps the tab as it is when a toolbar tool is clicked', () => {
    const { vm, wrappers } = renderCanvas([composedBlock(), textBlock()]);
    dispatch(wrappers[0].querySelector('.tool.clone'), 'click');
    expect(vm.duplicateBlock).toHaveBeenCalled();
    expect(vm.selectedTool()).toBe(0);
  });
});
