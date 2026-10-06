/**
 * @jest-environment jsdom
 */

'use strict';

// The composed block opens its builder straight from the canvas. Every way in
// goes through vm.openBlockBuilder, the function the panel's "Compose" button
// calls, so the flag and the accessors are checked in one place only — these
// tests assert on the modal toggle that function ends in, not on a stand-in.

const fr = require('../../../public/lang/badsender-fr.js');
const en = require('../../../public/lang/badsender-en.js');
const widgetBlockBuilder = require('../../../packages/editor/src/js/ext/badsender-widget-block-builder.js');
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

describe('composing a block from the canvas', () => {
  it('opens the builder on that block, with its markup and state', () => {
    const vm = createViewModel({ blockBuilderEnabled: true });
    const block = composedBlock('<p>mine</p>');
    vm.composeBlock(block);

    expect(vm.toggleBlockBuilderModal).toHaveBeenCalledTimes(1);
    const [open, options] = vm.toggleBlockBuilderModal.mock.calls[0];
    expect(open).toBe(true);
    expect(options.accessor()).toBe('<p>mine</p>');
    expect(options.stateAccessor()).toBe('{"v":1}');
  });

  it('goes through the function the panel button uses', () => {
    const vm = createViewModel({ blockBuilderEnabled: true });
    const spy = jest.spyOn(vm, 'openBlockBuilder');
    const block = composedBlock();
    vm.composeBlock(block);
    expect(spy).toHaveBeenCalledWith('builderHtml', block());
  });

  it('writes back to the block it was opened on', () => {
    const vm = createViewModel({ blockBuilderEnabled: true });
    const block = composedBlock();
    vm.composeBlock(block);
    vm.toggleBlockBuilderModal.mock.calls[0][1].accessor('<p>new</p>');
    expect(block().builderHtml()).toBe('<p>new</p>');
  });

  it('does nothing when the template no longer enables the builder', () => {
    const vm = createViewModel({ blockBuilderEnabled: false });
    vm.composeBlock(composedBlock());
    expect(vm.toggleBlockBuilderModal).not.toHaveBeenCalled();
  });

  it.each([
    ['the HTML code block', htmlCodeBlock],
    ['a template block', textBlock],
  ])('does nothing on %s', (_label, make) => {
    const vm = createViewModel({ blockBuilderEnabled: true });
    vm.composeBlock(make());
    expect(vm.toggleBlockBuilderModal).not.toHaveBeenCalled();
  });
});

describe('composing a block without structure rights', () => {
  it.each(['writer', 'reviewer'])('is refused to a %s', () => {
    const vm = createViewModel({ blockBuilderEnabled: true });
    vm.currentUser = () => ({ canEditStructure: false, canEditContent: true });
    const block = composedBlock();

    expect(vm.canComposeBlock(block)).toBe(false);
    vm.composeBlock(block);
    vm.openBlockFromCanvas(block, { target: document.body });

    expect(vm.toggleBlockBuilderModal).not.toHaveBeenCalled();
  });
});

describe('double-clicking a block in the canvas', () => {
  it('opens the builder on a composed block', () => {
    const block = composedBlock();
    const { vm, wrappers } = renderCanvas([block]);
    dispatch(wrappers[0], 'dblclick');
    expect(vm.toggleBlockBuilderModal).toHaveBeenCalledTimes(1);
    expect(vm.toggleBlockBuilderModal.mock.calls[0][1].accessor()).toBe(
      block().builderHtml()
    );
  });

  it('opens the block that was double-clicked, not its neighbour', () => {
    const first = composedBlock('<p>first</p>');
    const second = composedBlock('<p>second</p>');
    const { vm, wrappers } = renderCanvas([first, second]);
    dispatch(wrappers[1], 'dblclick');
    expect(vm.toggleBlockBuilderModal.mock.calls[0][1].accessor()).toBe(
      '<p>second</p>'
    );
  });

  it('leaves other blocks alone', () => {
    const { vm, wrappers } = renderCanvas([textBlock(), htmlCodeBlock()]);
    wrappers.forEach((wrapper) => dispatch(wrapper, 'dblclick'));
    expect(vm.toggleBlockBuilderModal).not.toHaveBeenCalled();
  });

  // Double-clicking "move down" twice is a gesture of its own.
  it('ignores a double click on the hover toolbar', () => {
    const { vm, wrappers } = renderCanvas([composedBlock(), textBlock()]);
    dispatch(wrappers[0].querySelector('.tool.movedown'), 'dblclick');
    expect(vm.toggleBlockBuilderModal).not.toHaveBeenCalled();
  });
});

describe('the Compose tool of the hover toolbar', () => {
  const composeTool = (wrapper) => wrapper.querySelector('.tool.compose');

  it('is declared next to duplicate and save, with a lucide icon', () => {
    const line = TEMPLATE.split('\n').find((l) => l.includes('tool compose'));
    expect(line).toMatch(
      /ko if: \$root\.canComposeBlock && \$root\.canComposeBlock\(\$data\)/
    );
    expect(line).toContain('click: $root.composeBlock.bind($element, $data)');
    expect(line).toContain('lucide-layout-template');
    expect(TEMPLATE.indexOf('tool compose')).toBeGreaterThan(
      TEMPLATE.indexOf('tool save')
    );
  });

  // The panel's button wears the same icon; the two are one action.
  it('uses the icon of the panel button', () => {
    expect(widgetBlockBuilder().widget().html('builderHtml', '', {})).toContain(
      'lucide-layout-template'
    );
  });

  it('has a title translated in French and English', () => {
    expect(TEMPLATE).toContain("$root.t('block-builder-tool-compose')");
    expect(fr['block-builder-tool-compose']).toEqual(expect.any(String));
    expect(en['block-builder-tool-compose']).toEqual(expect.any(String));
  });

  it('shows on a composed block only', () => {
    const { wrappers } = renderCanvas([
      composedBlock(),
      htmlCodeBlock(),
      textBlock(),
    ]);
    expect(wrappers.map((w) => Boolean(composeTool(w)))).toEqual([
      true,
      false,
      false,
    ]);
    expect(composeTool(wrappers[0]).getAttribute('title')).toBe(
      'block-builder-tool-compose'
    );
  });

  it('is gone when the template no longer enables the builder', () => {
    const { wrappers } = renderCanvas([composedBlock()], {
      blockBuilderEnabled: false,
    });
    expect(composeTool(wrappers[0])).toBeNull();
  });

  it('opens the builder on its own block', () => {
    const first = composedBlock('<p>first</p>');
    const second = composedBlock('<p>second</p>');
    const { vm, wrappers } = renderCanvas([first, second]);
    dispatch(composeTool(wrappers[1]).firstElementChild, 'click');
    expect(vm.toggleBlockBuilderModal).toHaveBeenCalledTimes(1);
    expect(vm.toggleBlockBuilderModal.mock.calls[0][1].accessor()).toBe(
      '<p>second</p>'
    );
  });
});
