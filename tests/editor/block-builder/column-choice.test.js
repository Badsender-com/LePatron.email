/**
 * @jest-environment jsdom
 */

'use strict';

// Choosing the column the palette adds to.
//
// The selection knew an element or a row, and a row meant its first column:
// a click on the palette could never reach the second column of a row, and a
// click on that column in the preview did nothing. Filling it took a drag, and
// nothing on screen said so. A row is now selected WITH one of its columns —
// the first unless told otherwise — and clicking a column in the preview
// selects it.

const Vue = require('vue/dist/vue.common');

const { openModal, unmountAll } = require('./drag-helpers.js');
const {
  COLUMN_ROW_ATTRIBUTE,
  COLUMN_INDEX_ATTRIBUTE,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  ACTIVE_COLUMN_CLASS,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/preview-document.js');

afterEach(unmountAll);

const shapeOf = (modal) =>
  modal.state.rows.map((row) =>
    row.columns.map((column) => column.elements.map((element) => element.type))
  );

function clickIn(doc, node) {
  const event = new doc.defaultView.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  });
  node.dispatchEvent(event);
  return event;
}

const columnNode = (doc, rowId, index) =>
  doc.querySelector(
    `[${COLUMN_ROW_ATTRIBUTE}="${rowId}"][${COLUMN_INDEX_ATTRIBUTE}="${index}"]`
  );

/** A text in a first row, then a second row in halves, both columns empty. */
async function withEmptyHalves() {
  const context = await openModal(['text']);
  const { modal } = context;
  const row = modal.addRow();
  modal.setRowWidths(row.id, [50, 50]);
  modal.renderPreview();
  return { ...context, row: modal.rowById(row.id) };
}

describe('choosing a column', () => {
  it('selects the row with the column it names', async () => {
    const { modal, row } = await withEmptyHalves();

    modal.selectColumn(row.id, 1);

    expect(modal.selectedRowId).toBe(row.id);
    expect(modal.activeColumn).toBe(row.columns[1]);
    expect(modal.activeColumnPlace).toEqual({ row: 2, column: 2 });
  });

  it('sends the palette to that column', async () => {
    const { modal, row } = await withEmptyHalves();

    modal.selectColumn(row.id, 1);
    modal.addElement('button');

    expect(shapeOf(modal)).toEqual([[['text']], [[], ['button']]]);
  });

  it('keeps the first column for a row selected without one', async () => {
    const { modal, row } = await withEmptyHalves();

    modal.selectRow(row.id);

    expect(modal.activeColumn).toBe(row.columns[0]);
  });

  // Derived, like the rest of the active column: a column that no longer
  // exists cannot stay chosen.
  it('falls back on the first column once the chosen one is gone', async () => {
    const { modal, row } = await withEmptyHalves();
    modal.selectColumn(row.id, 1);

    modal.setRowWidths(row.id, [100]);

    expect(modal.activeColumn).toBe(modal.rowById(row.id).columns[0]);
  });

  it('is undone by a drag that ends without a drop', async () => {
    const { modal, row } = await withEmptyHalves();
    modal.selectColumn(row.id, 1);
    const saved = modal.selection;

    modal.selectElement(null);
    modal.restoreSelection(saved);

    expect(modal.activeColumn).toBe(row.columns[1]);
  });
});

describe('a click on a column in the preview', () => {
  it('chooses an empty column', async () => {
    const { modal, doc, row } = await withEmptyHalves();

    clickIn(doc, columnNode(doc, row.id, 1));

    expect(modal.selectedRowId).toBe(row.id);
    expect(modal.activeColumn).toBe(row.columns[1]);
  });

  it('still selects the element it lands on', async () => {
    const { modal, doc } = await withEmptyHalves();
    const [text] = modal.state.rows[0].columns[0].elements;
    modal.selectRow(modal.state.rows[1].id);
    modal.renderPreview();

    clickIn(doc, doc.querySelector(`[data-lp-el="${text.id}"]`));

    expect(modal.selectedElementId).toBe(text.id);
  });
});

describe('the active column in the preview', () => {
  it('is marked while its row is selected', async () => {
    const { modal, doc, row } = await withEmptyHalves();

    modal.selectColumn(row.id, 1);
    await Vue.nextTick();

    expect(
      columnNode(doc, row.id, 1).classList.contains(ACTIVE_COLUMN_CLASS)
    ).toBe(true);
    expect(
      columnNode(doc, row.id, 0).classList.contains(ACTIVE_COLUMN_CLASS)
    ).toBe(false);
  });

  it('is marked again after a render', async () => {
    const { modal, doc, row } = await withEmptyHalves();
    modal.selectColumn(row.id, 1);
    await Vue.nextTick();

    modal.renderPreview();

    expect(
      columnNode(doc, row.id, 1).classList.contains(ACTIVE_COLUMN_CLASS)
    ).toBe(true);
  });

  it('is not marked while an element is selected', async () => {
    const { modal, doc, row } = await withEmptyHalves();
    modal.selectColumn(row.id, 1);
    await Vue.nextTick();

    modal.selectElement(modal.state.rows[0].columns[0].elements[0].id);
    await Vue.nextTick();

    expect(doc.querySelectorAll(`.${ACTIVE_COLUMN_CLASS}`)).toHaveLength(0);
  });
});
