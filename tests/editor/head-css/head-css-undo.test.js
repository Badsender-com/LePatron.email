'use strict';

// Head CSS lives outside `viewModel.content`, the only thing the undo stack's
// reactor watches. Without the hand-written tracking in undomain.js, Ctrl+Z
// after "Apply" undid the previous content edit instead, and left the
// stylesheet in place.

// The bundle aliases this name to ko-reactor (package.json aliasify), which
// registers `ko.watch` instead of exporting it; undomanager.js falls back to it.
jest.mock(
  'knockoutjs-reactor',
  () => {
    require('ko-reactor/dist/ko-reactor.js');
    return {};
  },
  { virtual: true }
);

const ko = require('knockout');
const addUndoStackExtensionMaker = require('../../../packages/editor/src/js/undomanager/undomain.js');

const passThrough = (_label, fn, ...args) => fn(...args);

function makeEditor() {
  const title = ko.observable('Hello');
  title._fieldName = 'title';
  const viewModel = {
    content: ko.observable({ title }),
    contentListeners: ko.observable(0),
    t: (key) => key,
    headCss: ko.observable('.seeded{}'),
  };
  const plugin = addUndoStackExtensionMaker(passThrough)(viewModel);
  return { viewModel, title, plugin };
}

describe('head CSS on the undo stack', () => {
  it('does not make the value seeded at load undoable', () => {
    const { viewModel, plugin } = makeEditor();
    viewModel.headCss('.before-init{}');
    plugin.init();

    expect(viewModel.undoCount()).toBe(0);
  });

  it('undoes an applied stylesheet in one step, and redoes it', () => {
    const { viewModel, plugin } = makeEditor();
    plugin.init();

    viewModel.headCss('.a{color:red}');
    expect(viewModel.undoCount()).toBe(1);

    viewModel.undo.execute();
    expect(viewModel.headCss()).toBe('.seeded{}');
    expect(viewModel.undoCount()).toBe(0);
    expect(viewModel.redoCount()).toBe(1);

    viewModel.redo.execute();
    expect(viewModel.headCss()).toBe('.a{color:red}');
    expect(viewModel.undoCount()).toBe(1);
  });

  it('undoes the stylesheet, not the content edit made before it', () => {
    const { viewModel, title, plugin } = makeEditor();
    plugin.init();

    title('Edited');
    viewModel.headCss('.a{color:red}');

    viewModel.undo.execute();
    expect(viewModel.headCss()).toBe('.seeded{}');
    expect(title()).toBe('Edited');

    viewModel.undo.execute();
    expect(title()).toBe('Hello');
  });

  it('keeps "Apply" one step of its own inside the modal merge window', () => {
    const { viewModel, title, plugin } = makeEditor();
    plugin.init();
    title('Edited');

    // What the modal's handleApply does around its single write.
    viewModel.setUndoModeMerge();
    viewModel.headCss('.a{color:red}');
    viewModel.setUndoModeOnce();

    expect(viewModel.undoCount()).toBe(2);
    viewModel.undo.execute();
    expect(viewModel.headCss()).toBe('.seeded{}');
    expect(title()).toBe('Edited');
  });

  it('stops tracking once disposed', () => {
    const { viewModel, plugin } = makeEditor();
    plugin.init();
    plugin.dispose();

    viewModel.headCss('.a{color:red}');
    expect(viewModel.undoCount()).toBe(0);
  });
});
