/**
 * @jest-environment jsdom
 */

'use strict';

// Escape in a comment field closes the mention suggestions first, and only
// then, once nothing is left to close inside, the comments panel.

const $ = require('jquery');
const ko = require('knockout');
const commentsLoader = require('../../packages/editor/src/js/ext/badsender-comments.js');

function mount() {
  jest.useFakeTimers();
  // Nothing reaches the server: the comments and counts load in the background.
  jest.spyOn($, 'ajax').mockImplementation(() => $.Deferred().promise());
  const vm = {
    t: (key) => key,
    selectedBlock: ko.observable(null),
    content: () => ({ mainBlocks: () => ({ blocks: () => [] }) }),
  };
  commentsLoader({ metadata: { id: 'm1', groupId: 'g1' } })(vm);
  document.body.innerHTML = `
    <div id="toolcomments" data-bind="rightPanel: 'comments'">
      <textarea id="field" data-bind="event: { keydown: $root.handleCommentKeydown }"></textarea>
    </div>`;
  ko.applyBindings(vm, document.body);
  vm.rightPanel.show('comments');
  return { vm, field: document.getElementById('field') };
}

const pressEscape = (target) => {
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
};

afterEach(() => {
  ko.cleanNode(document.body);
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Escape in a comment field', () => {
  it('closes the mention suggestions and leaves the panel open', () => {
    const { vm, field } = mount();
    vm.showMentionSuggestions(true);

    const event = pressEscape(field);

    expect(vm.showMentionSuggestions()).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(vm.showComments()).toBe(true);
  });

  it('closes the panel when no suggestion is open', () => {
    const { vm, field } = mount();

    const event = pressEscape(field);

    expect(event.defaultPrevented).toBe(false);
    expect(vm.showComments()).toBe(false);
  });

  it('lets the other keys through', () => {
    const { vm, field } = mount();
    vm.showMentionSuggestions(true);
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      bubbles: true,
      cancelable: true,
    });

    field.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(vm.showMentionSuggestions()).toBe(true);
  });
});
