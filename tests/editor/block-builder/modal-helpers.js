/**
 * Shared setup for the tests that drive the block builder modal itself — its
 * state machine, its keyboard, its dismissal — rather than its preview (for
 * which see drag-helpers.js).
 *
 * Not a test file — no `.test.js`, so Jest's default match leaves it alone.
 */

'use strict';

const Vue = require('vue/dist/vue.common');

const {
  BlockBuilderModalComponent,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/block-builder-modal.js');

// Every modal listens on the document for Escape: one left mounted by an
// earlier test would hear the next test's keystrokes.
const mounted = [];

/**
 * @param {Object} [overrides] view-model members to replace
 * @returns {{ vm: Object, modal: Object }}
 */
function mountModal(overrides) {
  // `currentBgimage` and `showDialogGallery` are the editor's own gallery
  // dialog, set up by the background image widget. The builder borrows them
  // rather than shipping a picker of its own.
  const vm = {
    t: (key) => key,
    startMultiple: jest.fn(),
    stopMultiple: jest.fn(),
    currentBgimage: jest.fn(),
    showDialogGallery: jest.fn(),
    ...overrides,
  };

  const host = document.createElement('div');
  document.body.appendChild(host);

  const app = new Vue({
    el: host,
    components: { BlockBuilderModal: BlockBuilderModalComponent },
    data: { vm },
    template: '<block-builder-modal :vm="vm" />',
  });
  mounted.push(app);

  return { vm, modal: app.$children[0] };
}

/**
 * A stand-in for a Knockout observable: called with no argument it reads,
 * called with one it writes. The modal reads both accessors when it opens, so a
 * mock that recorded every call as a write would count those reads too.
 */
function makeAccessor(initial) {
  const writes = [];
  let value = initial === undefined ? '' : initial;
  const accessor = (next) => {
    if (next === undefined) return value;
    value = next;
    writes.push(next);
    return value;
  };
  accessor.writes = writes;
  return accessor;
}

/**
 * Opens the modal on a pair of accessors.
 *
 * @param {Object} [stored] `{ markup, state }` already on the block
 * @param {Object} [vmOverrides] see mountModal
 */
function open(stored, vmOverrides) {
  const accessor = makeAccessor((stored && stored.markup) || '');
  const stateAccessor = makeAccessor((stored && stored.state) || '');
  const { vm, modal } = mountModal(vmOverrides);

  modal.handleToggle(true, { accessor, stateAccessor });

  return { vm, modal, accessor, stateAccessor, written: accessor.writes };
}

/** For `afterEach`: destroys every modal mounted, and empties the page. */
function unmountAll() {
  mounted.splice(0).forEach((app) => app.$destroy());
  document.body.innerHTML = '';
}

module.exports = { mountModal, makeAccessor, open, unmountAll };
