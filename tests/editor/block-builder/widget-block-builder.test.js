/**
 * @jest-environment jsdom
 */

'use strict';

// Same contract as the HTML code widget, on the other flag: the block
// definition is injected into every template whatever the flags, so a mailing
// composed while `blockBuilderEnabled` was on keeps its block once it is turned
// off. The server keeps accepting that stored markup but refuses any other
// (mailing/synthetic-block-guard.js), so the panel must say the block can no
// longer be edited rather than let the user compose and then fail to save.
//
// The flag read here is the builder's own. Reading `htmlBlockEnabled` instead
// would still pass every test above — and would silently hand the builder to
// whoever has the raw HTML block, and withhold it from whoever does not.

const ko = require('knockout');

const widgetBlockBuilder = require('../../../packages/editor/src/js/ext/badsender-widget-block-builder.js');

// The jQuery UI button binding is not what is under test.
ko.bindingHandlers.button = { init() {} };

function renderPanel(metadata) {
  const plugin = widgetBlockBuilder();
  const vm = {
    metadata,
    t: (key) => key,
    builderHtml: ko.observable('<p>composed</p>'),
    builderState: ko.observable('{"v":1}'),
  };
  plugin.viewModel(vm);

  const toggle = jest.fn();
  vm.toggleBlockBuilderModal = toggle;

  const host = document.createElement('div');
  host.innerHTML = plugin.widget().html('builderHtml', 'attr: {}', {});
  document.body.appendChild(host);
  ko.applyBindings(vm, host);

  return {
    vm,
    toggle,
    button: host.querySelector('.html-code-widget__button'),
    message: host.querySelector('.html-code-widget__disabled'),
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('block builder widget', () => {
  it('registers itself under the block builder widget name', () => {
    expect(widgetBlockBuilder().widget().widget).toBe('blockBuilder');
  });

  it('offers composing when the template enables the builder', () => {
    const { button, message } = renderPanel({ blockBuilderEnabled: true });
    expect(button.style.display).not.toBe('none');
    expect(message.style.display).toBe('none');
  });

  it('says the block can no longer be edited when it does not', () => {
    const { button, message } = renderPanel({ blockBuilderEnabled: false });
    expect(button.style.display).toBe('none');
    expect(message.style.display).not.toBe('none');
    expect(message.textContent).toBe('widget-block-builder-disabled');
  });

  // The whole reason for a second flag.
  it('ignores the HTML code block flag entirely', () => {
    const withHtmlOnly = renderPanel({
      htmlBlockEnabled: true,
      blockBuilderEnabled: false,
    });
    expect(withHtmlOnly.button.style.display).toBe('none');

    document.body.innerHTML = '';

    const withBuilderOnly = renderPanel({
      htmlBlockEnabled: false,
      blockBuilderEnabled: true,
    });
    expect(withBuilderOnly.button.style.display).not.toBe('none');
  });

  it('does not open the builder when the block cannot be edited', () => {
    const { vm, toggle } = renderPanel({ blockBuilderEnabled: false });
    vm.openBlockBuilder('builderHtml', vm);
    expect(toggle).not.toHaveBeenCalled();
  });

  it('opens it with both the markup and the state to reopen from', () => {
    const { vm, toggle } = renderPanel({ blockBuilderEnabled: true });
    vm.openBlockBuilder('builderHtml', vm);

    expect(toggle).toHaveBeenCalledWith(true, {
      accessor: expect.any(Function),
      stateAccessor: expect.any(Function),
    });
    const passed = toggle.mock.calls[0][1];
    expect(passed.accessor()).toBe('<p>composed</p>');
    expect(passed.stateAccessor()).toBe('{"v":1}');
  });

  // A block stored before the state property existed, or one whose state
  // failed to serialise: the modal treats a null accessor as "nothing to
  // reopen" rather than throwing.
  it('passes a null state accessor when the block holds no state', () => {
    const plugin = widgetBlockBuilder();
    const vm = {
      metadata: { blockBuilderEnabled: true },
      t: (key) => key,
      builderHtml: ko.observable('<p>composed</p>'),
    };
    plugin.viewModel(vm);
    const toggle = jest.fn();
    vm.toggleBlockBuilderModal = toggle;

    vm.openBlockBuilder('builderHtml', vm);

    expect(toggle.mock.calls[0][1].stateAccessor).toBeNull();
  });
});
