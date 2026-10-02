/**
 * @jest-environment jsdom
 */

'use strict';

// The text field drives the preview: each `input` it emits regenerates the
// block and re-renders the iframe. TinyMCE fires NodeChange on every caret
// move, so emitting on each event re-rendered the preview while nothing had
// changed. And the panel used to re-key the field on the selected element,
// tearing TinyMCE down and starting it again on every change of selection.

const Vue = require('vue/dist/vue.common');

const {
  ElementSettingsComponent,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/element-settings.js');

/** Just enough of TinyMCE 4 to drive the field: init, events, content, undo. */
function fakeTinyMce() {
  const editors = [];
  return {
    editors,
    init({ setup }) {
      const handlers = {};
      const editor = {
        content: '',
        on(names, handler) {
          names.split(' ').forEach((name) => {
            handlers[name] = handler;
          });
        },
        fire(name) {
          handlers[name]();
        },
        getContent() {
          return this.content;
        },
        setContent(value) {
          this.content = value;
        },
        undoManager: { clear: jest.fn() },
        remove: jest.fn(),
      };
      editors.push(editor);
      setup(editor);
      editor.fire('init');
    },
  };
}

const mounted = [];

async function mountPanel(element) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const changes = [];
  const app = new Vue({
    el: host,
    components: { ElementSettings: ElementSettingsComponent },
    data: { element },
    methods: {
      onChange(change) {
        changes.push(change);
        this.$set(this.element, change.key, change.value);
      },
    },
    template: '<element-settings :element="element" @change="onChange" />',
  });
  mounted.push(app);
  await Vue.nextTick();
  return { app, changes };
}

const text = (id, content) => ({ id, type: 'text', content, align: 'left' });

beforeEach(() => {
  window.tinymce = fakeTinyMce();
});

afterEach(() => {
  mounted.splice(0).forEach((app) => app.$destroy());
  delete window.tinymce;
  document.body.innerHTML = '';
});

describe('what the field emits', () => {
  it('emits nothing on a caret move', async () => {
    const { changes } = await mountPanel(text('a', 'Bonjour'));
    const [editor] = window.tinymce.editors;

    editor.fire('NodeChange');
    editor.fire('keyup');

    expect(changes).toEqual([]);
  });

  it('emits when the content actually changed', async () => {
    const { changes } = await mountPanel(text('a', 'Bonjour'));
    const [editor] = window.tinymce.editors;

    editor.content = 'Bonjour <strong>à tous</strong>';
    editor.fire('NodeChange');
    editor.fire('change');

    expect(changes).toEqual([
      { key: 'content', value: 'Bonjour <strong>à tous</strong>' },
    ]);
  });

  // The parent writes the emitted value back down as `value`: pushing it into
  // the editor again would reset the caret.
  it('does not push its own echo back into the editor', async () => {
    await mountPanel(text('a', 'Bonjour'));
    const [editor] = window.tinymce.editors;
    const setContent = jest.spyOn(editor, 'setContent');

    editor.content = 'Bonsoir';
    editor.fire('input');
    await Vue.nextTick();

    expect(setContent).not.toHaveBeenCalled();
  });
});

describe('moving the selection to another text', () => {
  it('keeps the same TinyMCE instance', async () => {
    const { app } = await mountPanel(text('a', 'Premier'));

    app.element = text('b', 'Second');
    await Vue.nextTick();

    expect(window.tinymce.editors).toHaveLength(1);
    expect(window.tinymce.editors[0].remove).not.toHaveBeenCalled();
  });

  it('shows the other text, with an undo history of its own', async () => {
    const { app } = await mountPanel(text('a', 'Premier'));
    const [editor] = window.tinymce.editors;

    app.element = text('b', 'Second');
    await Vue.nextTick();

    expect(editor.getContent()).toBe('Second');
    expect(editor.undoManager.clear).toHaveBeenCalled();
  });
});
