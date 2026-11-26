'use strict';

// What the email settings publish to the content stays out of the undo
// history. The settings are not in the history: a Ctrl+Z meant for a text edit
// that also took back `market = 'ca'` would leave the select on Canada and the
// content on Belgium, and the export disagreeing with the metadata saved.
//
// Run against the editor's real undo stack (undomain.js).

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
const addUndoStackExtensionMaker = require('../../packages/editor/src/js/undomanager/undomain.js');
const {
  publishOutsideUndo,
} = require('../../packages/editor/src/js/utils/publish-to-template.js');

const passThrough = (_label, fn, ...args) => fn(...args);

function makeEditor() {
  const title = ko.observable('Hello');
  title._fieldName = 'title';
  const market = ko.observable('be');
  market._fieldName = 'market';
  const viewModel = {
    content: ko.observable({ title, market }),
    contentListeners: ko.observable(0),
    t: (key) => key,
  };
  const plugin = addUndoStackExtensionMaker(passThrough)(viewModel);
  // What viewmodel.js defines on top of the stack.
  viewModel.startMultiple = () => viewModel.setUndoModeMerge();
  viewModel.stopMultiple = () => viewModel.setUndoModeOnce();
  plugin.init();
  return { viewModel, title, market };
}

describe('publishing the email settings, on the real undo stack', () => {
  it('writes the content without adding an undo step', () => {
    const { viewModel, market } = makeEditor();

    publishOutsideUndo(viewModel, { market: 'ca' });

    expect(market()).toBe('ca');
    expect(viewModel.undoCount()).toBe(0);
  });

  it('leaves the published value in place when a text edit is undone', () => {
    const { viewModel, title, market } = makeEditor();

    title('Edited');
    publishOutsideUndo(viewModel, { market: 'ca' });
    viewModel.undo.execute();

    expect(title()).toBe('Hello');
    expect(market()).toBe('ca');
  });

  it('leaves it in place when the edit is redone', () => {
    const { viewModel, title, market } = makeEditor();

    title('Edited');
    viewModel.undo.execute();
    publishOutsideUndo(viewModel, { market: 'ca' });
    viewModel.redo.execute();

    expect(title()).toBe('Edited');
    expect(market()).toBe('ca');
  });

  it('records the edits made after it as usual', () => {
    const { viewModel, title } = makeEditor();

    publishOutsideUndo(viewModel, { market: 'ca' });
    title('Edited');

    expect(viewModel.undoCount()).toBe(1);
    viewModel.undo.execute();
    expect(title()).toBe('Hello');
  });

  // A drag in progress merges its writes into one step: a publish landing in
  // the middle must not end the merge.
  it('leaves a merge in progress one step', () => {
    const { viewModel, title, market } = makeEditor();

    viewModel.startMultiple();
    title('First');
    publishOutsideUndo(viewModel, { market: 'ca' });
    title('Second');
    viewModel.stopMultiple();

    expect(viewModel.undoCount()).toBe(1);
    viewModel.undo.execute();
    expect(title()).toBe('Hello');
    expect(market()).toBe('ca');
  });

  it('publishes before the undo stack exists', () => {
    const market = ko.observable('be');

    publishOutsideUndo(
      { content: ko.observable({ market }) },
      { market: 'ca' }
    );

    expect(market()).toBe('ca');
  });
});
