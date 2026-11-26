/**
 * @jest-environment jsdom
 */

'use strict';

// The column the modal works on follows the selection.
//
// The palette, the element list and its arrows work on the ACTIVE column:
// the selected element's, a selected row's first one, or the first column of
// the first row when nothing is selected. Finding an element — a click in the
// preview, the outline, the selection on opening, whether the block is empty —
// looks across the whole composition.

const Vue = require('vue/dist/vue.common');

const {
  openModal,
  unmountAll,
  rowOf,
  SELECTED_CLASS,
  EMPTY_DROP_ID,
} = require('./drag-helpers.js');
const { open } = require('./modal-helpers.js');
const {
  serialiseState,
} = require('../../../packages/shared/block-builder/state.js');
const {
  emptyState,
} = require('../../../packages/shared/block-builder/generate.js');

afterEach(unmountAll);

/** The composition as types, row by row and column by column. */
const shapeOf = (modal) =>
  modal.state.rows.map((row) =>
    row.columns.map((column) => column.elements.map((element) => element.type))
  );

const typesOf = (elements) => elements.map((element) => element.type);

/**
 * One row in halves: a text on the left, a button on the right — the button
 * is where every element sat outside of before the column followed.
 */
async function withHalves() {
  const context = await openModal(['text', 'button']);
  const { modal } = context;
  const [row] = modal.state.rows;
  modal.setRowWidths(row.id, [50, 50]);
  const button = row.columns[0].elements[1];
  modal.moveElement(button.id, { rowId: row.id, columnIndex: 1, index: 0 });
  modal.renderPreview();
  return { ...context, row: modal.state.rows[0], button };
}

describe('the active column', () => {
  it('is the selected element’s column', async () => {
    const { modal, row, button } = await withHalves();

    modal.selectElement(button.id);

    expect(modal.activeColumn).toBe(row.columns[1]);
    expect(typesOf(modal.columnElements)).toEqual(['button']);
  });

  it('is the first column of a selected row', async () => {
    const { modal, row } = await withHalves();
    const second = modal.addRow();

    modal.selectRow(row.id);
    expect(modal.activeColumn).toBe(row.columns[0]);

    modal.selectRow(second.id);
    expect(modal.activeColumn).toBe(second.columns[0]);
  });

  it('is the first column of the first row when nothing is selected', async () => {
    const { modal, row } = await withHalves();

    modal.selectElement(null);

    expect(modal.activeColumn).toBe(row.columns[0]);
  });

  // Derived, not stored: nothing can keep pointing at a column that is gone.
  it('follows an element whose column disappears', async () => {
    const { modal, row, button } = await withHalves();
    modal.selectElement(button.id);

    modal.setRowWidths(row.id, [100]);

    expect(modal.selectedElementId).toBe(button.id);
    expect(modal.activeColumn).toBe(modal.state.rows[0].columns[0]);
    expect(typesOf(modal.columnElements)).toEqual(['text', 'button']);
  });

  it('falls back on the first column when the selected row is gone', async () => {
    const { modal, row } = await withHalves();
    const second = modal.addRow();

    modal.state.rows.splice(1, 1);

    expect(modal.selectedRowId).toBe(second.id);
    expect(modal.activeColumn).toBe(row.columns[0]);
  });
});

describe('the palette', () => {
  it('adds right after the selected element, in its column', async () => {
    const { modal, row, button } = await withHalves();
    modal.selectElement(row.columns[0].elements[0].id);

    modal.addElement('divider');
    modal.selectElement(button.id);
    modal.addElement('spacer');

    expect(shapeOf(modal)).toEqual([
      [
        ['text', 'divider'],
        ['button', 'spacer'],
      ],
    ]);
  });

  it('adds after the selected element, not at the end of its column', async () => {
    const { modal } = await openModal(['text', 'button']);
    modal.selectElement(modal.state.rows[0].columns[0].elements[0].id);

    modal.addElement('divider');

    expect(shapeOf(modal)).toEqual([[['text', 'divider', 'button']]]);
  });

  it('adds at the end of a selected row’s first column', async () => {
    const { modal, row } = await withHalves();
    modal.selectRow(row.id);

    modal.addElement('divider');

    expect(shapeOf(modal)).toEqual([[['text', 'divider'], ['button']]]);
  });

  // "Add a row", then "+ Text": the text belongs in the new row.
  it('fills the row just added', async () => {
    const { modal } = await openModal(['text']);

    modal.addRow();
    modal.addElement('text');

    expect(shapeOf(modal)).toEqual([[['text']], [['text']]]);
  });

  it('still adds when the composition has no row at all', async () => {
    const { modal } = await openModal([]);
    modal.state.rows.splice(0);

    modal.addElement('button');

    expect(shapeOf(modal)).toEqual([[['button']]]);
  });
});

describe('the element list', () => {
  it('shows the active column and moves within it', async () => {
    const { modal, row, button } = await withHalves();
    modal.selectElement(button.id);
    modal.addElement('divider');

    modal.move(-1);

    expect(typesOf(row.columns[1].elements)).toEqual(['divider', 'button']);
    expect(typesOf(row.columns[0].elements)).toEqual(['text']);
    expect(modal.canMove(-1)).toBe(false);
  });

  it('removes within the active column, and selects a neighbour there', async () => {
    const { modal, row, button } = await withHalves();
    modal.selectElement(button.id);
    const divider = modal.addElement('divider');
    modal.selectElement(button.id);

    modal.removeSelected();

    expect(shapeOf(modal)).toEqual([[['text'], ['divider']]]);
    expect(modal.selectedElementId).toBe(divider.id);
    expect(modal.activeColumn).toBe(row.columns[1]);
  });

  it('lists the elements of the active column', async () => {
    const { modal, button } = await withHalves();
    modal.selectElement(button.id);
    await Vue.nextTick();

    const items = document.querySelectorAll('.bb-modal__list [role="option"]');
    expect(items).toHaveLength(1);
    expect(items[0].getAttribute('aria-selected')).toBe('true');
  });

  // A new row is empty while the block is not: the list says so, the preview
  // does not offer the empty block's drop zone.
  it('says when the active column holds nothing', async () => {
    const { modal, doc } = await withHalves();
    modal.addRow();
    await Vue.nextTick();
    modal.renderPreview();

    expect(document.querySelector('.bb-modal__empty')).not.toBeNull();
    expect(modal.isEmpty).toBe(false);
    expect(doc.getElementById(EMPTY_DROP_ID)).toBeNull();
  });
});

describe('finding an element across the composition', () => {
  it('selects an element of any column from the preview', async () => {
    const { modal, doc, button } = await withHalves();

    rowOf(doc, button.id).dispatchEvent(
      new doc.defaultView.MouseEvent('click', { bubbles: true })
    );

    expect(modal.selectedElementId).toBe(button.id);
    expect(modal.selected).toBe(button);
  });

  it('outlines an element of any column', async () => {
    const { modal, doc, button } = await withHalves();

    modal.selectElement(button.id);
    await Vue.nextTick();

    expect(rowOf(doc, button.id).classList.contains(SELECTED_CLASS)).toBe(true);
  });

  it('applies a setting to an element of any column', async () => {
    const { modal, button } = await withHalves();
    modal.selectElement(button.id);

    modal.applySetting({ key: 'label', value: 'Réserver' });

    expect(button.label).toBe('Réserver');
  });

  it('opens on the first element of the composition', () => {
    const state = {
      ...emptyState(),
      rows: [
        {
          id: 'row-a-1',
          columns: [
            { width: 50, elements: [] },
            { width: 50, elements: [{ id: 'el-1', type: 'button' }] },
          ],
        },
      ],
    };
    const { modal } = open({ state: serialiseState(state) });

    expect(modal.selectedElementId).toBe('el-1');
    expect(modal.isEmpty).toBe(false);
  });
});
