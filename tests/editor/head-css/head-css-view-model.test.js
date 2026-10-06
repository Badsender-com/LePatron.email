'use strict';

// The two entry points to the head CSS (the Style tab, the HTML code block
// panel) read these predicates, and both openers check them again.
//
//   - flag on: the CSS is edited as before;
//   - flag off, CSS stored and an HTML code block present: that CSS is still
//     exported, so it is shown read-only, with a way to delete it — like the
//     block itself, which stays without being editable;
//   - flag off otherwise: nothing to show. Without a block nothing is
//     exported, and the CSS is kept for when one comes back.

const ko = require('knockout');

const {
  addHeadCssToViewModel,
} = require('../../../packages/editor/src/js/ext/head-css/view-model.js');
const fr = require('../../../public/lang/badsender-fr.js');
const en = require('../../../public/lang/badsender-en.js');

const CSS = '.a{color:red}';

function makeViewModel({ htmlBlockEnabled, css = CSS, withBlock = true }) {
  const blocks = ko.observableArray([
    ko.observable({ type: ko.observable('textBlock') }),
  ]);
  if (withBlock) {
    blocks.push(ko.observable({ type: ko.observable('htmlCodeBlock') }));
  }
  const viewModel = {
    content: ko.observable({ mainBlocks: ko.observable({ blocks }) }),
    metadata: { htmlBlockEnabled },
    toggleHtmlCodeModal: jest.fn(),
    currentUser: () => ({ canEditStyle: true }),
  };
  addHeadCssToViewModel(viewModel);
  viewModel.headCss(css);
  return { viewModel, blocks };
}

describe('isHeadCssEditable', () => {
  it('follows the template flag, block or not', () => {
    expect(
      makeViewModel({ htmlBlockEnabled: true }).viewModel.isHeadCssEditable()
    ).toBe(true);
    expect(
      makeViewModel({
        htmlBlockEnabled: true,
        withBlock: false,
      }).viewModel.isHeadCssEditable()
    ).toBe(true);
    expect(
      makeViewModel({ htmlBlockEnabled: false }).viewModel.isHeadCssEditable()
    ).toBe(false);
  });
});

describe('isHeadCssReadOnly', () => {
  it('is true with the flag off, CSS stored and a block present', () => {
    const { viewModel } = makeViewModel({ htmlBlockEnabled: false });
    expect(viewModel.isHeadCssReadOnly()).toBe(true);
  });

  it.each([
    ['the flag is on', { htmlBlockEnabled: true }],
    ['no CSS is stored', { htmlBlockEnabled: false, css: '' }],
    ['the CSS is blank', { htmlBlockEnabled: false, css: '  \n ' }],
    [
      'no HTML code block is left',
      { htmlBlockEnabled: false, withBlock: false },
    ],
  ])('is false when %s', (_label, params) => {
    expect(makeViewModel(params).viewModel.isHeadCssReadOnly()).toBe(false);
  });

  it('follows the blocks as they come and go', () => {
    const { viewModel, blocks } = makeViewModel({ htmlBlockEnabled: false });
    const readOnly = ko.pureComputed(viewModel.isHeadCssReadOnly);
    const seen = [];
    readOnly.subscribe((value) => seen.push(value));

    const removed = blocks.pop();
    blocks.push(removed);

    expect(seen).toEqual([false, true]);
  });
});

// Flag on, but no HTML code block: editing stays possible, and the Style tab
// says the CSS is not exported until the email holds one.
describe('isHeadCssAwaitingBlock', () => {
  it('is true with the flag on and no block', () => {
    const { viewModel } = makeViewModel({
      htmlBlockEnabled: true,
      withBlock: false,
    });
    expect(viewModel.isHeadCssAwaitingBlock()).toBe(true);
    expect(viewModel.isHeadCssEditable()).toBe(true);
  });

  it.each([
    ['a block is present', { htmlBlockEnabled: true }],
    ['the flag is off', { htmlBlockEnabled: false, withBlock: false }],
  ])('is false when %s', (_label, params) => {
    expect(makeViewModel(params).viewModel.isHeadCssAwaitingBlock()).toBe(
      false
    );
  });

  it('goes away once a block is added', () => {
    const { viewModel, blocks } = makeViewModel({
      htmlBlockEnabled: true,
      withBlock: false,
    });
    const awaiting = ko.pureComputed(viewModel.isHeadCssAwaitingBlock);
    const seen = [];
    awaiting.subscribe((value) => seen.push(value));

    blocks.push(ko.observable({ type: ko.observable('htmlCodeBlock') }));

    expect(seen).toEqual([false]);
  });
});

describe('the openers, by role', () => {
  it('refuses the editor to a user without style rights, not the viewer', () => {
    const { viewModel } = makeViewModel({ htmlBlockEnabled: true });
    viewModel.currentUser = () => ({ canEditStyle: false });

    expect(viewModel.canEditHeadCss()).toBe(false);
    viewModel.openHeadCssEditor();
    expect(viewModel.toggleHtmlCodeModal).not.toHaveBeenCalled();
  });

  it('refuses it while the user is not loaded yet', () => {
    const { viewModel } = makeViewModel({ htmlBlockEnabled: true });
    viewModel.currentUser = () => null;

    viewModel.openHeadCssEditor();
    expect(viewModel.toggleHtmlCodeModal).not.toHaveBeenCalled();
  });
});

describe('the openers', () => {
  it('opens the editable modal with the flag on, never the viewer', () => {
    const { viewModel } = makeViewModel({ htmlBlockEnabled: true });

    viewModel.openHeadCssViewer();
    expect(viewModel.toggleHtmlCodeModal).not.toHaveBeenCalled();

    viewModel.openHeadCssEditor();
    const options = viewModel.toggleHtmlCodeModal.mock.calls[0][1];
    expect(options.accessor).toBe(viewModel.headCss);
    expect(options.readOnly).toBeUndefined();
    expect(options.deleteKey).toBeUndefined();
  });

  it('opens the read-only viewer with the flag off, never the editor', () => {
    const { viewModel } = makeViewModel({ htmlBlockEnabled: false });

    viewModel.openHeadCssEditor();
    expect(viewModel.toggleHtmlCodeModal).not.toHaveBeenCalled();

    viewModel.openHeadCssViewer();
    expect(viewModel.toggleHtmlCodeModal).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        accessor: viewModel.headCss,
        mode: 'css',
        readOnly: true,
        noticeKey: 'head-css-read-only-hint',
        deleteKey: 'head-css-delete',
        deleteConfirmKey: 'head-css-delete-confirm',
      })
    );
  });

  it('opens nothing with the flag off and no block left', () => {
    const { viewModel } = makeViewModel({
      htmlBlockEnabled: false,
      withBlock: false,
    });

    viewModel.openHeadCssViewer();
    viewModel.openHeadCssEditor();

    expect(viewModel.toggleHtmlCodeModal).not.toHaveBeenCalled();
  });
});

describe('the labels', () => {
  it.each([
    'head-css-view-button',
    'head-css-read-only-hint',
    'head-css-delete',
    'head-css-delete-confirm',
    'widget-code-view-css',
    'html-code-modal-close',
    'head-css-not-exported-hint',
  ])('%s is translated in French and English', (key) => {
    expect(typeof fr[key]).toBe('string');
    expect(typeof en[key]).toBe('string');
    expect(fr[key]).not.toBe(en[key]);
  });
});
