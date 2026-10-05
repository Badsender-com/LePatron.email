/**
 * @jest-environment jsdom
 */

'use strict';

// One apply is one undo step, restoring BOTH properties.
//
// The builder writes two properties of its block — the markup and the state it
// reopens from. Were they to land in separate steps, one Ctrl+Z would put back
// the old markup under the new state: the next opening of the modal would show
// a composition that is not what the canvas shows, and the next apply would
// silently overwrite the one the user had just restored.
//
// Run against the editor's real undo stack (undomain.js), not a mock of
// startMultiple/stopMultiple: what matters is what the stack does with the two
// writes, not that two functions were called.

// The bundle aliases this name to ko-reactor (package.json aliasify), which
// registers `ko.watch` instead of exporting it; undomanager.js falls back to it.
jest.mock(
  'knockoutjs-reactor',
  () => {
    require('ko-reactor/dist/ko-reactor.min.js');
    return {};
  },
  { virtual: true }
);

const ko = require('knockout');

const addUndoStackExtensionMaker = require('../../../packages/editor/src/js/undomanager/undomain.js');
const {
  BlockBuilderModalComponent,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/block-builder-modal.js');

const passThrough = (_label, fn, ...args) => fn(...args);

/**
 * A view-model with the real undo stack, and a block's two builder properties
 * in its content — where the undo stack's reactor watches.
 */
function makeEditor() {
  const builderHtml = ko.observable('<p>avant</p>');
  builderHtml._fieldName = 'builderHtml';
  const builderState = ko.observable('{"v":1,"elements":[]}');
  builderState._fieldName = 'builderState';
  const viewModel = {
    content: ko.observable({ builderHtml, builderState }),
    contentListeners: ko.observable(0),
    t: (key) => key,
    showDialogGallery: () => false,
  };
  const plugin = addUndoStackExtensionMaker(passThrough)(viewModel);
  // What viewmodel.js defines on top of the stack.
  viewModel.startMultiple = () => viewModel.setUndoModeMerge();
  viewModel.stopMultiple = () => viewModel.setUndoModeOnce();
  plugin.init();
  // The editor runs in "once" mode between operations.
  viewModel.setUndoModeOnce();
  return { viewModel, builderHtml, builderState, plugin };
}

let modal;

function composeAndApply({ viewModel, builderHtml, builderState }) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  // Mounted directly, so the view-model is a prop and Vue leaves its
  // observables alone.
  modal = new BlockBuilderModalComponent({
    el: host,
    propsData: { vm: viewModel },
  });
  // Knockout observables are the accessors the widget hands the modal.
  modal.handleToggle(true, {
    accessor: builderHtml,
    stateAccessor: builderState,
  });
  modal.addElement('text');
  modal.applySetting({ key: 'content', value: 'Après' });
  modal.handleApply();
}

afterEach(() => {
  if (modal) modal.$destroy();
  modal = null;
  document.body.innerHTML = '';
});

describe('applying a composition, on the real undo stack', () => {
  it('writes both properties', () => {
    const editor = makeEditor();

    composeAndApply(editor);

    expect(editor.builderHtml()).toContain('Après');
    expect(JSON.parse(editor.builderState()).elements).toHaveLength(1);
  });

  it('costs exactly one undo step', () => {
    const editor = makeEditor();

    composeAndApply(editor);

    expect(editor.viewModel.undoCount()).toBe(1);
  });

  it('restores both the markup and the state with that one step', () => {
    const editor = makeEditor();

    composeAndApply(editor);
    editor.viewModel.undo.execute();

    expect(editor.builderHtml()).toBe('<p>avant</p>');
    expect(editor.builderState()).toBe('{"v":1,"elements":[]}');
    expect(editor.viewModel.undoCount()).toBe(0);
  });

  it('redoes both with one step', () => {
    const editor = makeEditor();

    composeAndApply(editor);
    editor.viewModel.undo.execute();
    editor.viewModel.redo.execute();

    expect(editor.builderHtml()).toContain('Après');
    expect(JSON.parse(editor.builderState()).elements).toHaveLength(1);
  });

  // Without the merge, the stack's "once" mode still holds the two writes as
  // two steps — which is what this file exists to rule out.
  it('would take two steps without the merge', () => {
    const editor = makeEditor();
    editor.viewModel.startMultiple = () => {};
    editor.viewModel.stopMultiple = () => {};

    composeAndApply(editor);

    expect(editor.viewModel.undoCount()).toBe(2);
  });
});
