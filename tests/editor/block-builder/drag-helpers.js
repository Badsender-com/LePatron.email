/**
 * Shared setup for the drag tests of the block builder modal.
 *
 * Not a test file — no `.test.js`, so Jest's default match leaves it alone.
 *
 * It exists because two test files needed the same eighty lines of scaffolding:
 * mounting the modal, faking a DataTransfer, giving jsdom's zero-height rows a
 * box to measure. SonarCloud counted that as duplication and failed the gate,
 * which was the right call — the scaffolding is not the test, and having it
 * twice means a fix to the fake only lands in one of them.
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
const DROP_BEFORE_CLASS = 'lp-bb-drop-before';
const DROP_AFTER_CLASS = 'lp-bb-drop-after';
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

/** A stand-in for the DataTransfer the browser hands a real drag. */
const transfer = () => ({
  effectAllowed: null,
  dropEffect: null,
  data: {},
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
 * @returns {Promise<{modal: Object, doc: Document}>}
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
  modal.handleToggle(true, {
    accessor: accessorOf(''),
    stateAccessor: accessorOf(''),
  });
  await Vue.nextTick();

  (types || []).forEach((type) => modal.addElement(type));
  modal.renderPreview();

  return { modal, doc: modal.$refs.previewFrame.contentDocument };
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
  paletteEntry,
  startPaletteDrag,
  typesOf,
  ELEMENT_ATTRIBUTE,
  PALETTE_TYPES,
  SELECTED_CLASS,
  DRAGGING_CLASS,
  DROP_BEFORE_CLASS,
  DROP_AFTER_CLASS,
  MOVING_CLASS,
  EMPTY_DROP_ID,
};
