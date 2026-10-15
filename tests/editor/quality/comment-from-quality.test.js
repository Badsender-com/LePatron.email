/**
 * @jest-environment jsdom
 */

'use strict';

// "Add comment" in the quality drawer prepares a comment draft: never posted,
// never at the expense of a comment the user is writing.

const $ = require('jquery');
const ko = require('knockout');
const commentsLoader = require('../../../packages/editor/src/js/ext/badsender-comments.js');
const { fakeViewModel } = require('./fake-view-model');

function editorWithComments() {
  jest.useFakeTimers();
  // Nothing reaches the server: the comments and counts load in the background.
  jest.spyOn($, 'ajax').mockImplementation(() => $.Deferred().promise());
  const vm = fakeViewModel({ blocks: [{ id: 'b1', type: 'heroBlock' }] });
  vm.selectBlock = jest.fn();
  // What the editor's view model has and the comments panel follows.
  vm.selectedBlock = ko.observable(null);
  commentsLoader({ metadata: { id: 'm1', groupId: 'g1' } })(vm);
  return vm;
}

const draft = (overrides = {}) => ({
  blockId: 'b1',
  text: 'Quality control · Links : Link not filled in: Buy now',
  severity: 'blocking',
  category: 'content',
  ...overrides,
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('createCommentFromQc', () => {
  it('opens the comments on the block, with the draft ready', () => {
    const vm = editorWithComments();
    vm.createCommentFromQc(draft());

    expect(vm.showComments()).toBe(true);
    expect(vm.selectedBlockForComments()).toBe('b1');
    expect(vm.newCommentText()).toBe(draft().text);
    expect(vm.newCommentSeverity()).toBe('blocking');
  });

  it('adds the finding after a comment being written, never over it', () => {
    const vm = editorWithComments();
    vm.newCommentText('Please check the hero');

    vm.createCommentFromQc(draft());

    expect(vm.newCommentText()).toBe(
      `Please check the hero\n\n${draft().text}`
    );
  });

  it('comments on the whole email when the block was deleted since the check', () => {
    const vm = editorWithComments();
    vm.createCommentFromQc(draft({ blockId: 'gone' }));

    expect(vm.showComments()).toBe(true);
    expect(vm.selectedBlockForComments()).toBeNull();
    expect(vm.selectBlock).not.toHaveBeenCalled();
  });
});
