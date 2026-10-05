/**
 * @jest-environment jsdom
 */

'use strict';

// The CodeMirror modal was written for the HTML code block and is now shared
// with the head CSS editor. Two things must hold, and neither is obvious from
// reading the component:
//
//   - opening it the old way — `toggleHtmlCodeModal(true, { accessor })` —
//     must behave exactly as before, HTML mode and HTML labels;
//   - opening it for head CSS must not leak its CSS mode, labels or bound into
//     the next HTML edit.
//
// Both are checked through the options the component hands to CodeMirror,
// which is where a regression would actually show up.

const Vue = require('vue/dist/vue.common');

// CodeMirror is a global in the editor (gulpfile.js mosaicoLibList), not a
// module: a fake records the options it is created with.
const created = [];
global.window.CodeMirror = {
  fromTextArea(textarea, options) {
    created.push(options);
    let value = '';
    return {
      setValue(next) {
        value = next;
      },
      getValue: () => value,
      on() {},
      off() {},
      toTextArea() {},
      focus() {},
    };
  },
};

const {
  HtmlCodeModalComponent,
} = require('../../../packages/editor/src/js/vue/components/html-code-modal/html-code-modal.js');
const {
  HTML_CODE_MAX_LENGTH,
} = require('../../../packages/editor/src/js/ext/html-code-block/constants.js');
const {
  HEAD_CSS_MAX_LENGTH,
} = require('../../../packages/shared/head-css/constants.js');

const HEAD_CSS_OPTIONS = {
  mode: 'css',
  titleKey: 'head-css-modal-title',
  placeholderKey: 'head-css-placeholder',
  tooLargeKey: 'head-css-too-large',
  maxLength: HEAD_CSS_MAX_LENGTH,
};

function mountModal() {
  const vm = {
    t: jest.fn((key) => key),
    notifier: { error: jest.fn() },
    startMultiple: jest.fn(),
    stopMultiple: jest.fn(),
  };

  const host = document.createElement('div');
  document.body.appendChild(host);

  const app = new Vue({
    el: host,
    components: { HtmlCodeModal: HtmlCodeModalComponent },
    data: { vm },
    template: '<html-code-modal :vm="vm" />',
  });

  return { vm, app, modal: app.$children[0] };
}

/** Opens the editor and resolves once CodeMirror has been created. */
async function open(modal, payload) {
  modal.handleToggle(true, payload);
  await Vue.nextTick();
  await Vue.nextTick();
  return created[created.length - 1];
}

beforeEach(() => {
  created.length = 0;
});

describe('the shared code modal', () => {
  it('defaults to the HTML code block when opened with only an accessor', async () => {
    const { modal } = mountModal();
    const accessor = jest.fn(() => '<p>stored</p>');

    const options = await open(modal, { accessor });

    expect(options.mode).toBe('htmlmixed');
    expect(options.placeholder).toBe('html-code-placeholder');
    expect(modal.options.titleKey).toBe('html-code-modal-title');
    expect(modal.options.maxLength).toBe(HTML_CODE_MAX_LENGTH);
  });

  it('switches to CSS when opened for head CSS', async () => {
    const { modal } = mountModal();
    const accessor = jest.fn(() => '.a{color:red}');

    const options = await open(modal, { accessor, ...HEAD_CSS_OPTIONS });

    expect(options.mode).toBe('css');
    expect(options.placeholder).toBe('head-css-placeholder');
    expect(modal.options.titleKey).toBe('head-css-modal-title');
    expect(modal.options.maxLength).toBe(HEAD_CSS_MAX_LENGTH);
  });

  // The regression this file exists to catch.
  it('does not leak the CSS options into the next HTML edit', async () => {
    const { modal } = mountModal();

    await open(modal, { accessor: jest.fn(() => ''), ...HEAD_CSS_OPTIONS });
    modal.closeModal();
    const options = await open(modal, { accessor: jest.fn(() => '') });

    expect(options.mode).toBe('htmlmixed');
    expect(modal.options.maxLength).toBe(HTML_CODE_MAX_LENGTH);
  });

  it('enforces the bound it was opened with', async () => {
    const { modal, vm } = mountModal();
    const accessor = jest.fn();

    await open(modal, { accessor, ...HEAD_CSS_OPTIONS });
    modal.editor.setValue('a'.repeat(HEAD_CSS_MAX_LENGTH + 1));
    modal.handleApply();

    // The message is built by `vm.t`, so the key and its interpolation are
    // what this asserts — not whatever the stub returns.
    expect(vm.t).toHaveBeenCalledWith('head-css-too-large', {
      max: HEAD_CSS_MAX_LENGTH,
    });
    expect(vm.notifier.error).toHaveBeenCalled();
    expect(accessor).not.toHaveBeenCalledWith(expect.any(String));
  });

  it('writes through the accessor in a single undo step', async () => {
    const { modal, vm } = mountModal();
    const accessor = jest.fn(() => '');

    await open(modal, { accessor, ...HEAD_CSS_OPTIONS });
    modal.editor.setValue('.a{color:red}');
    modal.handleApply();

    expect(vm.startMultiple).toHaveBeenCalled();
    expect(accessor).toHaveBeenCalledWith('.a{color:red}');
    expect(vm.stopMultiple).toHaveBeenCalled();
  });
});

// With the template flag off, CSS the email still exports is shown read-only,
// like the HTML code block itself: nothing to apply, but a way to delete it.
describe('the shared code modal, read-only', () => {
  const READ_ONLY_OPTIONS = {
    ...HEAD_CSS_OPTIONS,
    readOnly: true,
    noticeKey: 'head-css-read-only-hint',
    deleteKey: 'head-css-delete',
    deleteConfirmKey: 'head-css-delete-confirm',
  };
  const button = (app, name) =>
    app.$el.querySelector('button[name="' + name + '"]');

  let confirmSpy;
  beforeEach(() => {
    confirmSpy = jest.spyOn(window, 'confirm');
  });
  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it('opens CodeMirror read-only, without Apply, saying why', async () => {
    const { modal, app } = mountModal();

    const options = await open(modal, {
      accessor: jest.fn(() => '.a{color:red}'),
      ...READ_ONLY_OPTIONS,
    });

    expect(options.readOnly).toBe(true);
    expect(button(app, 'submitAction')).toBeNull();
    expect(button(app, 'deleteAction').textContent.trim()).toBe(
      'head-css-delete'
    );
    expect(button(app, 'closeAction').textContent.trim()).toBe(
      'html-code-modal-close'
    );
    expect(
      app.$el.querySelector('.html-code-modal__notice').textContent.trim()
    ).toBe('head-css-read-only-hint');
  });

  it('never writes through Apply', async () => {
    const { modal } = mountModal();
    const accessor = jest.fn(() => '.a{color:red}');

    await open(modal, { accessor, ...READ_ONLY_OPTIONS });
    modal.editor.setValue('.b{color:blue}');
    modal.handleApply();

    expect(accessor).not.toHaveBeenCalledWith(expect.any(String));
  });

  it('clears the CSS in one undo step once Delete is confirmed', async () => {
    const { modal, vm } = mountModal();
    const accessor = jest.fn(() => '.a{color:red}');
    confirmSpy.mockReturnValue(true);

    await open(modal, { accessor, ...READ_ONLY_OPTIONS });
    modal.handleDelete();

    expect(confirmSpy).toHaveBeenCalledWith('head-css-delete-confirm');
    expect(vm.startMultiple).toHaveBeenCalled();
    expect(accessor).toHaveBeenCalledWith('');
    expect(vm.stopMultiple).toHaveBeenCalled();
    expect(modal.accessor).toBeNull();
  });

  it('keeps the CSS when Delete is not confirmed', async () => {
    const { modal } = mountModal();
    const accessor = jest.fn(() => '.a{color:red}');
    confirmSpy.mockReturnValue(false);

    await open(modal, { accessor, ...READ_ONLY_OPTIONS });
    modal.handleDelete();

    expect(accessor).not.toHaveBeenCalledWith(expect.any(String));
    expect(modal.accessor).toBe(accessor);
  });

  it('keeps the CSS on Close', async () => {
    const { modal, app } = mountModal();
    const accessor = jest.fn(() => '.a{color:red}');

    await open(modal, { accessor, ...READ_ONLY_OPTIONS });
    button(app, 'closeAction').click();

    expect(accessor).not.toHaveBeenCalledWith(expect.any(String));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  // The read-only options must not leak into the next edit, as the CSS ones
  // must not leak into an HTML one.
  it('is editable again, without Delete, the next time it opens', async () => {
    const { modal, app } = mountModal();

    await open(modal, { accessor: jest.fn(() => ''), ...READ_ONLY_OPTIONS });
    modal.closeModal();
    const options = await open(modal, {
      accessor: jest.fn(() => ''),
      ...HEAD_CSS_OPTIONS,
    });

    expect(options.readOnly).toBe(false);
    expect(button(app, 'submitAction')).not.toBeNull();
    expect(button(app, 'deleteAction')).toBeNull();
    expect(button(app, 'closeAction').textContent.trim()).toBe(
      'html-code-modal-cancel'
    );
  });
});
