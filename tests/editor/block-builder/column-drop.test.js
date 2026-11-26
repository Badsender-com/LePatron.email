/**
 * @jest-environment jsdom
 */

'use strict';

// Dropping into a column of the preview, through the events a browser sends:
// a dragover that aims, a drop that lands where it aimed. The boxes are given
// by hand (jsdom lays nothing out): every row 100px tall, its columns sharing
// the 600px of the block equally, its elements sharing its height.

const {
  openModal,
  unmountAll,
  startPaletteDrag,
  dragOverAt,
  dropAt,
  dropLineOf,
  placeAt,
} = require('./drag-helpers.js');

afterEach(unmountAll);

const ROW_HEIGHT = 100;
const TARGET_CLASS = 'lp-bb-col--target';

function layOutColumns(doc) {
  const columns = Array.prototype.slice.call(
    doc.querySelectorAll('.lp-bb-col')
  );
  const rowIds = [
    ...new Set(columns.map((c) => c.getAttribute('data-lp-row'))),
  ];
  columns.forEach((column) => {
    const rowId = column.getAttribute('data-lp-row');
    const count = columns.filter(
      (other) => other.getAttribute('data-lp-row') === rowId
    ).length;
    const width = 600 / count;
    const left = Number(column.getAttribute('data-lp-col')) * width;
    const top = rowIds.indexOf(rowId) * ROW_HEIGHT;
    placeAt(column.closest('td'), { left, width, top, height: ROW_HEIGHT });

    const elements = column.querySelectorAll('[data-lp-el]');
    const height = ROW_HEIGHT / Math.max(elements.length, 1);
    elements.forEach((element, index) =>
      placeAt(element, { left, width, top: top + index * height, height })
    );
  });
}

/** The composition as types, row by row and column by column. */
const shapeOf = (modal) =>
  modal.state.rows.map((row) =>
    row.columns.map((column) => column.elements.map((element) => element.type))
  );

async function halves() {
  const opened = await openModal(['text']);
  opened.modal.setRowWidths(opened.modal.state.rows[0].id, [50, 50]);
  opened.modal.renderPreview();
  layOutColumns(opened.doc);
  return opened;
}

const columnOf = (doc, index) => doc.querySelectorAll('.lp-bb-col')[index];

describe('aiming at a column', () => {
  it('marks the column the drop would land in, and only that one', async () => {
    const { doc } = await halves();
    startPaletteDrag('button');

    dragOverAt(doc, 30, 450);

    expect(columnOf(doc, 1).classList.contains(TARGET_CLASS)).toBe(true);
    expect(columnOf(doc, 0).classList.contains(TARGET_CLASS)).toBe(false);

    dragOverAt(doc, 30, 100);

    expect(columnOf(doc, 0).classList.contains(TARGET_CLASS)).toBe(true);
    expect(columnOf(doc, 1).classList.contains(TARGET_CLASS)).toBe(false);
  });

  it('draws the insertion line across the column aimed at, not the block', async () => {
    const { doc } = await halves();
    startPaletteDrag('button');

    dragOverAt(doc, 80, 100);

    const line = dropLineOf(doc);
    expect(line).not.toBeNull();
    expect(line.style.left).toBe('0px');
    expect(line.style.width).toBe('300px');
  });

  it('draws it across the whole preview while the block is flat', async () => {
    const { doc } = await openModal(['text']);
    placeAt(doc.querySelector('[data-lp-el]'), { top: 0, height: 100 });
    startPaletteDrag('button');

    dragOverAt(doc, 80, 100);

    expect(dropLineOf(doc).style.width).toBe('');
  });

  it('forgets the column once the drag is over', async () => {
    const { modal, doc } = await halves();
    startPaletteDrag('button');
    dragOverAt(doc, 30, 450);

    modal.handleDragEnd();

    expect(doc.querySelectorAll(`.${TARGET_CLASS}`)).toHaveLength(0);
    expect(modal.dropTarget).toBeNull();
  });
});

describe('dropping into a column', () => {
  it('lands in the column under the cursor', async () => {
    const { modal, doc } = await halves();
    startPaletteDrag('button');

    dropAt(doc, 30, 450);

    expect(shapeOf(modal)).toEqual([[['text'], ['button']]]);
  });

  it('moves an element into the column under the cursor', async () => {
    const { modal, doc } = await halves();
    const [text] = modal.state.rows[0].columns[0].elements;
    const node = doc.querySelector(`[data-lp-el="${text.id}"]`);
    const start = new doc.defaultView.Event('dragstart', { bubbles: true });
    node.dispatchEvent(start);

    dropAt(doc, 30, 450);

    expect(shapeOf(modal)).toEqual([[[], ['text']]]);
  });

  // "Add a row", two columns, then the palette: the row holds nothing, and
  // the preview still has to offer it.
  it('lands in a row just added, which holds nothing yet', async () => {
    const { modal, doc } = await openModal(['text']);
    const added = modal.addRow();
    modal.setRowWidths(added.id, [50, 50]);
    modal.renderPreview();
    layOutColumns(doc);
    startPaletteDrag('text');

    dropAt(doc, ROW_HEIGHT + 20, 450);

    expect(shapeOf(modal)).toEqual([[['text']], [[], ['text']]]);
  });
});
