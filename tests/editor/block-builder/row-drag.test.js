/**
 * @jest-environment jsdom
 */

'use strict';

// Dragging a row in the list of rows, through the events a browser sends —
// with Mosaico's page guard in place on `window`, which cancels every
// `dragstart` and `drag` that reaches it (template-loader.js fixPageEvents).
// A test calling the handlers directly is what hid that guard the first time.

const Vue = require('vue/dist/vue.common');

const {
  openModal,
  unmountAll,
  transfer,
  fireIn,
  startPaletteDrag,
  dropLineOf,
  placeAt,
  DRAGGING_CLASS,
} = require('./drag-helpers.js');

// Duplicated, like the class names in drag-helpers.js.
const DRAG_TYPE = 'application/x-lp-block-builder';
const ROW_HEIGHT = 30;

const cancel = (event) => event.preventDefault();

beforeEach(() => {
  window.addEventListener('dragstart', cancel);
  window.addEventListener('drag', cancel);
});

afterEach(() => {
  window.removeEventListener('dragstart', cancel);
  window.removeEventListener('drag', cancel);
  unmountAll();
});

const options = () =>
  Array.prototype.slice.call(
    document.querySelectorAll('.bb-modal__rows [role="option"]')
  );
const wrapper = () => document.querySelector('.bb-modal__rows-drop');

/** Three rows, A B C, laid out 30px each from the top. */
async function threeRows() {
  const opened = await openModal(['text']);
  opened.modal.addRow();
  opened.modal.addRow();
  await Vue.nextTick();
  options().forEach((option, index) =>
    placeAt(option, { top: index * ROW_HEIGHT, height: ROW_HEIGHT })
  );
  return { ...opened, ids: opened.modal.state.rows.map((row) => row.id) };
}

/** A real event on a node of the editor page, bubbling as a browser's does. */
function fire(type, target, clientY) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  event.dataTransfer = transfer();
  if (clientY !== undefined) event.clientY = clientY;
  target.dispatchEvent(event);
  return event;
}

const rowIds = (modal) => modal.state.rows.map((row) => row.id);

describe('starting to drag a row', () => {
  it('starts despite the page guard, and carries the row', async () => {
    const { modal, ids } = await threeRows();

    const start = fire('dragstart', options()[1]);
    const drag = fire('drag', options()[1]);

    expect(start.defaultPrevented).toBe(false);
    expect(drag.defaultPrevented).toBe(false);
    expect(start.dataTransfer.getData(DRAG_TYPE)).toBe(ids[1]);
    expect(Object.keys(start.dataTransfer.data)).toEqual([DRAG_TYPE]);
    expect(start.dataTransfer.effectAllowed).toBe('move');
    expect(modal.draggingRowId).toBe(ids[1]);
    expect(modal.selectedRowId).toBe(ids[1]);
  });

  // Nothing in the preview moves until the drop: holding it would leave it
  // frozen if the drag never ends, with what the user types missing from it.
  it('leaves the preview rendering', async () => {
    const { modal } = await threeRows();

    fire('dragstart', options()[0]);
    modal.scheduleRender();

    expect(modal.renderFrozen).toBe(false);
    expect(modal.renderHeld).toBe(false);
  });
});

describe('dropping a row in the list', () => {
  it('moves the first row one place down from the lower half of the second', async () => {
    const { modal, ids } = await threeRows();
    fire('dragstart', options()[0]);

    fire('dragover', options()[1], 50);
    fire('drop', options()[1], 50);

    expect(rowIds(modal)).toEqual([ids[1], ids[0], ids[2]]);
    expect(modal.selectedRowId).toBe(ids[0]);
    expect(modal.draggingRowId).toBeNull();
  });

  it('moves a row last when dropped below the last one', async () => {
    const { modal, ids } = await threeRows();
    fire('dragstart', options()[0]);

    fire('dragover', wrapper(), 100);
    fire('drop', wrapper(), 100);

    expect(rowIds(modal)).toEqual([ids[1], ids[2], ids[0]]);
  });

  it('accepts the row as a move, and draws where it would land', async () => {
    await threeRows();
    fire('dragstart', options()[2]);

    const over = fire('dragover', options()[0], 10);
    await Vue.nextTick();

    expect(over.defaultPrevented).toBe(true);
    expect(over.dataTransfer.dropEffect).toBe('move');
    expect(options()[0].classList).toContain('bb-modal__row--drop-before');
  });

  it('draws the line under the last row for the end', async () => {
    await threeRows();
    fire('dragstart', options()[0]);

    fire('dragover', wrapper(), 100);
    await Vue.nextTick();

    expect(wrapper().classList).toContain('bb-modal__rows-drop--end');
  });

  // Dropped on either of its own edges, the row stays: a line there would
  // promise a move the drop does not make.
  it('draws no line where the row would stay', async () => {
    const { modal } = await threeRows();
    fire('dragstart', options()[1]);

    fire('dragover', options()[1], 40);
    fire('dragover', options()[2], 70);
    await Vue.nextTick();

    expect(modal.rowDropIndex).toBeNull();
    expect(document.querySelector('.bb-modal__row--drop-before')).toBeNull();
  });

  // The list takes a row, not what the palette drags: that lands in the
  // preview, and the page refuses it everywhere else.
  it('leaves a palette drag to the page, which refuses it', async () => {
    await threeRows();
    startPaletteDrag('text');

    const over = fire('dragover', options()[0], 10);

    expect(over.dataTransfer.dropEffect).toBe('none');
  });
});

describe('a row drag that ends without a drop', () => {
  it('moves nothing, and gives the selection back', async () => {
    const { modal, ids } = await threeRows();
    const [text] = modal.state.rows[0].columns[0].elements;
    modal.selectElement(text.id);
    fire('dragstart', options()[1]);
    fire('dragover', options()[2], 80);

    fire('dragend', options()[1]);

    expect(rowIds(modal)).toEqual(ids);
    expect(modal.selectedElementId).toBe(text.id);
    expect(modal.draggingRowId).toBeNull();
    expect(modal.rowDropIndex).toBeNull();
    expect(modal.renderFrozen).toBe(false);
  });
});

describe('a row over the preview', () => {
  it('is refused there, with no insertion line', async () => {
    const { modal, doc, ids } = await threeRows();
    fire('dragstart', options()[0]);

    const over = fireIn(doc, 'dragover', doc.body, 10);
    fireIn(doc, 'drop', doc.body, 10);

    expect(over.defaultPrevented).toBe(true);
    expect(over.dataTransfer.dropEffect).toBe('none');
    expect(dropLineOf(doc)).toBeNull();
    expect(doc.body.classList.contains(DRAGGING_CLASS)).toBe(false);
    expect(rowIds(modal)).toEqual(ids);
  });
});
