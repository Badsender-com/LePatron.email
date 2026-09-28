/**
 * @jest-environment jsdom
 */

'use strict';

// Reordering by dragging a row of the preview.
//
// The arrows stay — they are the keyboard path and the precise one — but moving
// an element by dragging it is how anyone expects a builder to behave, and it is
// the gesture the arrows make tedious the moment there are more than three
// elements.
//
// The part worth pinning is the arithmetic. A drop index counts rows as they are
// laid out NOW, with the dragged element still among them; taking it out shifts
// everything after it up by one. Get that wrong and dropping an element just
// below itself moves it one row too far — which looks like the feature "almost"
// works, the hardest kind of bug to report.

const Vue = require('vue/dist/vue.common');

const {
  BlockBuilderModalComponent,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/block-builder-modal.js');
const {
  ELEMENT_ATTRIBUTE,
} = require('../../../packages/shared/block-builder/generate.js');

const MOVING = 'lp-bb-moving';
const DRAGGING = 'lp-bb-dragging';
// Duplicated, like the class names: a test that imported it could not notice
// it being changed back to something TinyMCE pastes.
const DRAG_TYPE = 'application/x-lp-block-builder';

// Every app mounted, so each test can destroy its own: a drag left running
// would otherwise keep its page listeners into the next one.
const mounted = [];

function accessorOf(initial) {
  let value = initial === undefined ? '' : initial;
  return (next) => {
    if (next === undefined) return value;
    value = next;
    return value;
  };
}

async function open(types) {
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
  mounted.push(app);

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

// Starts with a `text/plain` already on it, as a browser may fill in by itself.
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

const PALETTE_TYPES = ['text', 'image', 'button', 'divider', 'spacer'];

/**
 * Starts a drag from the palette, with a real event on the real entry.
 *
 * Calling the handler with a hand-made object instead is what let the palette
 * drag ship broken once already: a plain object has no `stopPropagation`, so
 * the editor page's guard — which cancels every native drag — stayed invisible.
 */
function startPaletteDrag(type) {
  const entry = document.querySelectorAll('.bb-modal__add')[
    PALETTE_TYPES.indexOf(type)
  ];
  expect(entry).toBeTruthy();

  const event = new window.Event('dragstart', {
    bubbles: true,
    cancelable: true,
  });
  event.dataTransfer = transfer();
  entry.dispatchEvent(event);
  return event;
}

const rows = (doc) =>
  Array.prototype.slice.call(
    doc.body.querySelectorAll(`[${ELEMENT_ATTRIBUTE}]`)
  );

/** jsdom lays nothing out, so every row is given a box of its own. */
function layOutRows(doc, height) {
  rows(doc).forEach((row, index) => {
    row.getBoundingClientRect = () => ({
      top: index * height,
      bottom: (index + 1) * height,
      height,
    });
  });
}

function fire(doc, type, target, clientY) {
  const event = new doc.defaultView.Event(type, {
    bubbles: true,
    cancelable: true,
  });
  event.dataTransfer = transfer();
  if (clientY !== undefined) event.clientY = clientY;
  target.dispatchEvent(event);
  return event;
}

const types = (modal) => modal.state.elements.map((element) => element.type);

// The row is dimmed a task after dragstart, once the drag image is taken.
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  mounted.splice(0).forEach((app) => app.$destroy());
  document.body.innerHTML = '';
});

describe('a rendered row can be picked up', () => {
  it('is marked draggable, without that reaching the generated markup', async () => {
    const { modal, doc } = await open(['text', 'button']);

    rows(doc).forEach((row) => expect(row.draggable).toBe(true));
    // `draggable` is preview chrome. An email has no use for it.
    expect(modal.html).not.toContain('draggable');
  });

  // Set on the nodes, so every render has to set it again.
  it('is still draggable after the preview renders again', async () => {
    const { modal, doc } = await open(['text']);

    modal.addElement('button');
    modal.renderPreview();

    expect(rows(doc)).toHaveLength(2);
    rows(doc).forEach((row) => expect(row.draggable).toBe(true));
  });

  // Otherwise the browser picks up the image or the link, and the cursor
  // carries a picture of that, or its URL, instead of the row.
  it('leaves the row as the only thing in it to drag', async () => {
    const { doc } = await open(['image', 'button']);

    expect(doc.body.querySelector('img').draggable).toBe(false);
    expect(doc.body.querySelector('a').draggable).toBe(false);
  });

  it('records what is being moved, and says so to the browser', async () => {
    const { modal, doc } = await open(['text', 'button']);
    const [, second] = modal.state.elements;

    const event = fire(doc, 'dragstart', rows(doc)[1]);

    expect(event.defaultPrevented).toBe(false);
    expect(modal.draggingId).toBe(second.id);
    expect(event.dataTransfer.effectAllowed).toBe('move');
    expect(doc.body.classList.contains(DRAGGING)).toBe(true);
  });

  // Released over the settings panel's TinyMCE field, a `text/plain` would be
  // pasted there: the element id, as text.
  it('carries nothing a text field would paste', async () => {
    const { modal, doc } = await open(['text', 'button']);
    const [first] = modal.state.elements;

    const event = fire(doc, 'dragstart', rows(doc)[0]);

    expect(event.dataTransfer.data).toEqual({ [DRAG_TYPE]: first.id });
  });

  // An image or a link a browser lets start the drag anyway moves its row.
  it('picks up the row when the drag starts on its image or link', async () => {
    const { modal, doc } = await open(['image', 'button']);
    const [image, button] = modal.state.elements;

    const fromImage = fire(doc, 'dragstart', doc.body.querySelector('img'));
    expect(fromImage.defaultPrevented).toBe(false);
    expect(modal.draggingId).toBe(image.id);
    modal.handleDragEnd();

    fire(doc, 'dragstart', doc.body.querySelector('a'));
    expect(modal.draggingId).toBe(button.id);
  });

  it('says it is a move, over the preview', async () => {
    const { doc } = await open(['text', 'button']);
    layOutRows(doc, 100);

    fire(doc, 'dragstart', rows(doc)[0]);
    const over = fire(doc, 'dragover', doc.body, 190);

    expect(over.defaultPrevented).toBe(true);
    expect(over.dataTransfer.dropEffect).toBe('move');
    expect(doc.getElementById('lp-bb-drop-line')).toBeTruthy();
  });

  // Mosaico cancels dragover on the whole editor window, which would have the
  // page accept the row anywhere once it leaves the iframe.
  it('refuses the drop outside the preview, and says so', async () => {
    const { doc } = await open(['text', 'button']);
    fire(doc, 'dragstart', rows(doc)[0]);

    const over = fire(document, 'dragover', document.body);

    expect(over.defaultPrevented).toBe(true);
    expect(over.dataTransfer.dropEffect).toBe('none');
  });

  // Otherwise the cursor carries something invisible — but only once the
  // browser has taken its picture, or the ghost comes out dimmed too.
  it('dims the row under the cursor, after the drag image is taken', async () => {
    const { doc } = await open(['text', 'button']);

    fire(doc, 'dragstart', rows(doc)[0]);
    expect(rows(doc)[0].classList.contains(MOVING)).toBe(false);
    await nextTask();

    expect(rows(doc)[0].classList.contains(MOVING)).toBe(true);
    expect(rows(doc)[1].classList.contains(MOVING)).toBe(false);
  });

  // So the settings panel follows the thing being moved.
  it('selects what is being moved', async () => {
    const { modal, doc } = await open(['text', 'button']);
    const [first] = modal.state.elements;
    modal.selectedId = null;

    fire(doc, 'dragstart', rows(doc)[0]);

    expect(modal.selectedId).toBe(first.id);
  });

  it('ignores a drag that did not start on a row', async () => {
    const { modal, doc } = await open(['text']);

    const event = fire(doc, 'dragstart', doc.body);

    expect(event.defaultPrevented).toBe(true);
    expect(modal.draggingId).toBeNull();
  });
});

describe('the drop moves the element', () => {
  it('moves it up', async () => {
    const { modal, doc } = await open(['text', 'button', 'divider']);
    layOutRows(doc, 100);

    fire(doc, 'dragstart', rows(doc)[2]);
    fire(doc, 'drop', doc.body, 10);

    expect(types(modal)).toEqual(['divider', 'text', 'button']);
  });

  it('moves it down', async () => {
    const { modal, doc } = await open(['text', 'button', 'divider']);
    layOutRows(doc, 100);

    fire(doc, 'dragstart', rows(doc)[0]);
    fire(doc, 'drop', doc.body, 290);

    expect(types(modal)).toEqual(['button', 'divider', 'text']);
  });

  // The off-by-one. Dropping an element just past itself must not skip a row.
  it('lands exactly one place down, not two', async () => {
    const { modal, doc } = await open(['text', 'button', 'divider']);
    layOutRows(doc, 100);

    // Past the midpoint of the second row: index 2 in current layout.
    fire(doc, 'dragstart', rows(doc)[0]);
    fire(doc, 'drop', doc.body, 160);

    expect(types(modal)).toEqual(['button', 'text', 'divider']);
  });

  it('leaves the order alone when dropped where it already is', async () => {
    const { modal, doc } = await open(['text', 'button', 'divider']);
    layOutRows(doc, 100);

    fire(doc, 'dragstart', rows(doc)[1]);
    fire(doc, 'drop', doc.body, 120);

    expect(types(modal)).toEqual(['text', 'button', 'divider']);
  });

  it('keeps the moved element selected', async () => {
    const { modal, doc } = await open(['text', 'button', 'divider']);
    layOutRows(doc, 100);
    const [, second] = modal.state.elements;

    fire(doc, 'dragstart', rows(doc)[1]);
    fire(doc, 'drop', doc.body, 10);

    expect(modal.selectedId).toBe(second.id);
    expect(modal.selected.type).toBe('button');
  });

  it('clears the drag state and the dimming', async () => {
    const { modal, doc } = await open(['text', 'button']);
    layOutRows(doc, 100);

    fire(doc, 'dragstart', rows(doc)[0]);
    await nextTask();
    fire(doc, 'dragover', doc.body, 190);
    fire(doc, 'drop', doc.body, 190);

    expect(modal.draggingId).toBeNull();
    expect(doc.body.classList.contains(DRAGGING)).toBe(false);
    expect(doc.body.querySelectorAll(`.${MOVING}`)).toHaveLength(0);
    expect(doc.getElementById('lp-bb-drop-line')).toBeNull();
  });

  // A drag abandoned outside the preview, or cancelled with Escape.
  it('puts everything back when the drag ends without a drop', async () => {
    const { modal, doc } = await open(['text', 'button']);

    fire(doc, 'dragstart', rows(doc)[0]);
    await nextTask();
    fire(doc, 'dragend', rows(doc)[0]);

    expect(modal.draggingId).toBeNull();
    expect(types(modal)).toEqual(['text', 'button']);
    expect(doc.body.querySelectorAll(`.${MOVING}`)).toHaveLength(0);
  });
});

describe('a reorder and an insertion do not get confused', () => {
  it('inserts when the drag came from the palette', async () => {
    const { modal, doc } = await open(['text']);
    layOutRows(doc, 100);

    startPaletteDrag('button');
    fire(doc, 'drop', doc.body, 10);

    expect(types(modal)).toEqual(['button', 'text']);
  });

  it('moves when the drag came from a row', async () => {
    const { modal, doc } = await open(['text', 'button']);
    layOutRows(doc, 100);

    fire(doc, 'dragstart', rows(doc)[1]);
    fire(doc, 'drop', doc.body, 10);

    expect(types(modal)).toEqual(['button', 'text']);
    expect(modal.state.elements).toHaveLength(2);
  });

  // The preview must hold still for a reorder exactly as it does for an
  // insertion: replacing the body destroys the row under the cursor.
  it('holds renders for the duration of a reorder', async () => {
    const { modal, doc } = await open(['text', 'button']);

    fire(doc, 'dragstart', rows(doc)[0]);
    modal.scheduleRender();

    expect(modal.renderHeld).toBe(true);
  });
});

describe('the arrows still work', () => {
  it('moves the selected element up', async () => {
    const { modal } = await open(['text', 'button']);

    modal.move(-1);

    expect(types(modal)).toEqual(['button', 'text']);
  });
});
