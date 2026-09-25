/**
 * @jest-environment jsdom
 */

'use strict';

// The block definition is injected into every template, whatever the flag, so a
// mailing written while the flag was on keeps its block once it is turned off.
// The server keeps accepting that stored markup but refuses any other
// (mailing/html-code-block-guard.js): the panel must say the block can no longer
// be edited, rather than let the user edit it and then fail to save.

const ko = require('knockout');

const widgetCode = require('../../../packages/editor/src/js/ext/badsender-widget-code.js');

// The jQuery UI button binding is not what is under test.
ko.bindingHandlers.button = { init() {} };

function renderPanel(htmlBlockEnabled) {
  const plugin = widgetCode();
  const vm = {
    metadata: { htmlBlockEnabled },
    t: (key) => key,
    htmlCode: ko.observable('<p>stored</p>'),
  };
  plugin.viewModel(vm);

  const toggle = jest.fn();
  vm.toggleHtmlCodeModal = toggle;

  const host = document.createElement('div');
  host.innerHTML = plugin.widget().html('htmlCode', 'attr: {}', {});
  document.body.appendChild(host);
  ko.applyBindings(vm, host);

  return {
    vm,
    toggle,
    button: host.querySelector('.html-code-widget__button'),
    cssButton: host.querySelector('.html-code-widget__button--secondary'),
    cssHint: host.querySelector('.html-code-widget__hint'),
    message: host.querySelector('.html-code-widget__disabled'),
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('HTML code widget', () => {
  it('offers the editor when the template enables the block', () => {
    const { button, message } = renderPanel(true);
    expect(button.style.display).not.toBe('none');
    expect(message.style.display).toBe('none');
  });

  it('says the block can no longer be edited when it does not', () => {
    const { button, message } = renderPanel(false);
    expect(button.style.display).toBe('none');
    expect(message.style.display).not.toBe('none');
    expect(message.textContent).toBe('widget-code-disabled');
  });

  // The head CSS has a second entry point here, because this is where someone
  // who just pasted markup looks for a way to make it responsive. It follows
  // the same flag as the block: with editing off, there is nothing to style.
  it('offers the email CSS alongside, with its scope spelled out', () => {
    const { cssButton, cssHint } = renderPanel(true);
    expect(cssButton.style.display).not.toBe('none');
    expect(cssHint.textContent).toBe('widget-code-css-hint');
  });

  it('hides the email CSS when the block cannot be edited', () => {
    const { cssButton, cssHint } = renderPanel(false);
    expect(cssButton.style.display).toBe('none');
    expect(cssHint.style.display).toBe('none');
  });

  it('does not open the editor when the block cannot be edited', () => {
    const { vm, toggle } = renderPanel(false);
    vm.openHtmlCodeEditor('htmlCode', vm);
    expect(toggle).not.toHaveBeenCalled();
  });

  it('opens it, on the clicked property, when it can', () => {
    const { vm, toggle } = renderPanel(true);
    vm.openHtmlCodeEditor('htmlCode', vm);
    expect(toggle).toHaveBeenCalledWith(true, {
      accessor: expect.any(Function),
    });
    expect(toggle.mock.calls[0][1].accessor()).toBe('<p>stored</p>');
  });
});
