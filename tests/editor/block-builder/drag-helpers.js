/**
 * Shared setup for the tests that drive the block builder's preview.
 *
 * Not a test file — no `.test.js`, so Jest's default match leaves it alone.
 *
 * It exists because every one of them needs the same scaffolding: mounting the
 * modal, opening it on a pair of accessors, faking a DataTransfer, giving
 * jsdom's zero-height rows a box to measure. Written out once per file, that
 * was enough duplication to fail the quality gate — and rightly: the
 * scaffolding is not the test, and having it three times means a fix to the
 * fake lands in one file and not the others.
 */

'use strict';

const Vue = require('vue/dist/vue.common');

const {
  BlockBuilderModalComponent,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/block-builder-modal.js');
const {
  ELEMENT_ATTRIBUTE,
} = require('../../../packages/shared/block-builder/generate.js');

// The classes the preview uses to say what is happening. Duplicated from the
// component on purpose: a test that imported them could not notice a rename
// that breaks the stylesheet.
const SELECTED_CLASS = 'lp-bb-selected';
const DRAGGING_CLASS = 'lp-bb-dragging';
const DROP_LINE_ID = 'lp-bb-drop-line';
const MOVING_CLASS = 'lp-bb-moving';
const EMPTY_DROP_ID = 'lp-bb-empty-drop';

// The palette's order, which is what indexes an entry in the DOM.
const PALETTE_TYPES = ['text', 'image', 'button', 'divider', 'spacer'];

/**
 * A stand-in for a Knockout observable: reads with no argument, writes with one.
 */
function accessorOf(initial) {
  let value = initial === undefined ? '' : initial;
  return (next) => {
    if (next === undefined) return value;
    value = next;
    return value;
  };
}

/**
 * A stand-in for the DataTransfer the browser hands a real drag.
 *
 * Starts with a `text/plain` already on it, as a browser may fill in by itself:
 * the palette has to clear it, or a drop on a text field pastes it.
 */
const transfer = () => ({
  effectAllowed: null,
  dropEffect: null,
  data: { 'text/plain': 'filled in by the browser' },
  clearData() {
    this.data = {};
  },
  setData(type, value) {
    this.data[type] = value;
  },
  getData(type) {
    return this.data[type];
  },
});

/**
 * Mounts the modal, opens it, composes, and renders the preview.
 *
 * `renderPreview` is called directly rather than waited for: the real path goes
 * through a requestAnimationFrame, and what these tests are about is the
 * dragging, not the scheduling.
 *
 * @param {string[]} [types] element types to add, in order
 * @returns {Promise<{modal: Object, doc: Document, markup: Function}>}
 */
async function openModal(types) {
  const host = document.createElement('div');
  document.body.appendChild(host);

  const app = new Vue({
    el: host,
    components: { BlockBuilderModal: BlockBuilderModalComponent },
    data: {
      vm: {
        t: (key) => key,
        startMultiple: jest.fn(),
        stopMultiple: jest.fn(),
      },
    },
    template: '<block-builder-modal :vm="vm" />',
  });

  const modal = app.$children[0];
  // Kept, so a test can read back what Apply wrote: the modal forgets its
  // accessors as it closes.
  const markup = accessorOf('');
  modal.handleToggle(true, {
    accessor: markup,
    stateAccessor: accessorOf(''),
  });
  await Vue.nextTick();

  (types || []).forEach((type) => modal.addElement(type));
  modal.renderPreview();

  return { modal, doc: modal.$refs.previewFrame.contentDocument, markup };
}

/** The rendered rows, in document order. */
const rowsOf = (doc) =>
  Array.prototype.slice.call(
    doc.body.querySelectorAll(`[${ELEMENT_ATTRIBUTE}]`)
  );

/** The rendered row carrying an element's id. */
const rowOf = (doc, id) =>
  doc.body.querySelector(`[${ELEMENT_ATTRIBUTE}="${id}"]`);

/**
 * Gives every row a box.
 *
 * jsdom lays nothing out, so `getBoundingClientRect` is all zeroes and the
 * midpoint arithmetic the drop index relies on has nothing to work on.
 */
function layOutRows(doc, height) {
  rowsOf(doc).forEach((row, index) => {
    row.getBoundingClientRect = () => ({
      top: index * height,
      bottom: (index + 1) * height,
      height,
    });
  });
}

/**
 * Dispatches a real event inside the preview document.
 *
 * Real, not a hand-made object: a plain `{ dataTransfer }` has no
 * `stopPropagation` and nothing bubbles, which is exactly what hid the editor
 * page's drag guard from the tests the first time round.
 */
function fireIn(doc, type, target, clientY) {
  const event = new doc.defaultView.Event(type, {
    bubbles: true,
    cancelable: true,
  });
  event.dataTransfer = transfer();
  if (clientY !== undefined) event.clientY = clientY;
  target.dispatchEvent(event);
  return event;
}

/** A dragover, then a drop, at a height in the preview. */
const dragOverAt = (doc, clientY) => fireIn(doc, 'dragover', doc.body, clientY);
const dropAt = (doc, clientY) => fireIn(doc, 'drop', doc.body, clientY);

/** The palette entry for a type, queried on the document. */
const paletteEntry = (type) =>
  document.querySelectorAll('.bb-modal__add')[PALETTE_TYPES.indexOf(type)];

/**
 * Starts a drag from the palette, with a real event on the real entry.
 *
 * Same reason as `fireIn`: the palette's dragstart has to reach an ancestor for
 * the page guard to be part of what is tested.
 */
function startPaletteDrag(type) {
  const entry = paletteEntry(type);
  expect(entry).toBeTruthy();

  const event = new window.Event('dragstart', {
    bubbles: true,
    cancelable: true,
  });
  event.dataTransfer = transfer();
  entry.dispatchEvent(event);
  return event;
}

/** The insertion line, or null when none is drawn. */
const dropLineOf = (doc) => doc.getElementById(DROP_LINE_ID);

/** The element types currently composed, in order. */
const typesOf = (modal) => modal.state.elements.map((element) => element.type);

module.exports = {
  openModal,
  accessorOf,
  transfer,
  rowsOf,
  rowOf,
  layOutRows,
  fireIn,
  dragOverAt,
  dropAt,
  paletteEntry,
  startPaletteDrag,
  typesOf,
  dropLineOf,
  ELEMENT_ATTRIBUTE,
  PALETTE_TYPES,
  SELECTED_CLASS,
  DRAGGING_CLASS,
  DROP_LINE_ID,
  MOVING_CLASS,
  EMPTY_DROP_ID,
};
