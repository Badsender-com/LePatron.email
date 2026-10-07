/**
 * @jest-environment jsdom
 */

'use strict';

// Acceptance tests for the columns slice, at the third seam: the modal, through
// its props and events (epic #1194).
//
// Only what needs a DOM lives here. Everything about the markup a composition
// produces is checked on the pure functions instead — see
// tests/shared/block-builder/columns.test.js — because a layout regression is
// far easier to read as a string than as a jsdom tree.
//
// What genuinely needs the component: a drop target is now two-dimensional, and
// selection has two kinds where it had one.

const { openModal, fireIn, startPaletteDrag } = require('./drag-helpers.js');

afterEach(() => {
  document.body.innerHTML = '';
});

/** The composition as types, row by row and column by column. */
const shapeOf = (modal) =>
  modal.state.rows.map((row) =>
    row.columns.map((column) => column.elements.map((element) => element.type))
  );

// Turned on by #1210 (selecting a row, and setting its structure)
describe.skip('selecting a row', () => {
  it('starts with one row of one column', async () => {
    const { modal } = await openModal(['text']);

    expect(shapeOf(modal)).toEqual([[['text']]]);
  });

  it('selects the element when the click lands inside a column', async () => {
    const { modal, doc } = await openModal(['text']);
    const [element] = modal.state.rows[0].columns[0].elements;

    modal.selectElement(element.id);

    expect(modal.selectedElementId).toBe(element.id);
    expect(modal.selectedRowId).toBeNull();
    expect(doc).toBeTruthy();
  });

  it('selects the row when the click lands on its handle', async () => {
    const { modal } = await openModal(['text']);
    const [row] = modal.state.rows;

    modal.selectRow(row.id);

    expect(modal.selectedRowId).toBe(row.id);
    expect(modal.selectedElementId).toBeNull();
  });

  // Two panels fighting over one slot is how a settings panel starts showing
  // the wrong thing: only one kind of selection is ever active.
  it('never has both kinds of selection at once', async () => {
    const { modal } = await openModal(['text']);
    const [row] = modal.state.rows;
    const [element] = row.columns[0].elements;

    modal.selectRow(row.id);
    modal.selectElement(element.id);

    expect(modal.selectedRowId).toBeNull();
    expect(modal.selectedElementId).toBe(element.id);
  });

  describe('the structure', () => {
    it('splits a row into the widths of a preset', async () => {
      const { modal } = await openModal(['text']);
      const [row] = modal.state.rows;

      modal.setRowWidths(row.id, [50, 50]);

      expect(modal.state.rows[0].columns.map((c) => c.width)).toEqual([50, 50]);
    });

    it('accepts widths no preset offers', async () => {
      const { modal } = await openModal(['text']);
      const [row] = modal.state.rows;

      modal.setRowWidths(row.id, [37, 63]);

      expect(modal.state.rows[0].columns.map((c) => c.width)).toEqual([37, 63]);
    });

    it('refuses widths that do not total 100', async () => {
      const { modal } = await openModal(['text']);
      const [row] = modal.state.rows;

      modal.setRowWidths(row.id, [50, 40]);

      expect(modal.state.rows[0].columns.map((c) => c.width)).toEqual([100]);
    });

    it('refuses a fifth column', async () => {
      const { modal } = await openModal(['text']);
      const [row] = modal.state.rows;

      modal.setRowWidths(row.id, [20, 20, 20, 20, 20]);

      expect(modal.state.rows[0].columns.length).toBeLessThanOrEqual(4);
    });

    // Losing a paragraph to a structure change is the kind of thing a user
    // never forgives, and never reports precisely enough to reproduce.
    it('keeps the elements of a column that disappears', async () => {
      const { modal } = await openModal(['text', 'button']);
      const [row] = modal.state.rows;
      modal.setRowWidths(row.id, [50, 50]);
      modal.moveElement(modal.state.rows[0].columns[0].elements[1].id, {
        rowId: row.id,
        columnIndex: 1,
        index: 0,
      });

      modal.setRowWidths(row.id, [100]);

      expect(shapeOf(modal)).toEqual([[['text', 'button']]]);
    });
  });
});

// Turned on by #1211 (dropping into a column, and moving a row)
describe.skip('dropping into a column', () => {
  it('drops an element from the palette into the column under the cursor', async () => {
    const { modal, doc } = await openModal(['text']);
    modal.setRowWidths(modal.state.rows[0].id, [50, 50]);

    startPaletteDrag('button');
    modal.setDropTarget({
      rowId: modal.state.rows[0].id,
      columnIndex: 1,
      index: 0,
    });
    fireIn(doc, 'drop', doc.body, 10);

    expect(shapeOf(modal)).toEqual([[['text'], ['button']]]);
  });

  it('moves an element from one column into another', async () => {
    const { modal } = await openModal(['text', 'button']);
    const [row] = modal.state.rows;
    modal.setRowWidths(row.id, [50, 50]);
    const moved = modal.state.rows[0].columns[0].elements[1];

    modal.moveElement(moved.id, { rowId: row.id, columnIndex: 1, index: 0 });

    expect(shapeOf(modal)).toEqual([[['text'], ['button']]]);
  });

  it('keeps the settings of an element it moves', async () => {
    const { modal } = await openModal(['button']);
    const [row] = modal.state.rows;
    const button = row.columns[0].elements[0];
    button.label = 'Réserver';
    modal.setRowWidths(row.id, [50, 50]);

    modal.moveElement(button.id, { rowId: row.id, columnIndex: 1, index: 0 });

    expect(modal.state.rows[0].columns[1].elements[0].label).toBe('Réserver');
  });

  it('accepts a drop into a column holding nothing', async () => {
    const { modal } = await openModal(['text']);
    const [row] = modal.state.rows;
    modal.setRowWidths(row.id, [50, 50]);

    expect(modal.canDropInto({ rowId: row.id, columnIndex: 1 })).toBe(true);
  });

  // The off-by-one of the single-column builder, which must not come back now
  // that the index is counted inside a column rather than across the block.
  it('lands exactly one place down, not two', async () => {
    const { modal } = await openModal(['text', 'button', 'divider']);
    const [row] = modal.state.rows;
    const first = row.columns[0].elements[0];

    modal.moveElement(first.id, { rowId: row.id, columnIndex: 0, index: 2 });

    expect(shapeOf(modal)).toEqual([[['button', 'text', 'divider']]]);
  });

  it('keeps editing chrome out of the generated markup', async () => {
    const { modal } = await openModal(['text']);
    modal.setRowWidths(modal.state.rows[0].id, [50, 50]);

    expect(modal.html).not.toContain('draggable');
    expect(modal.html).not.toContain('lp-bb-');
  });
});

// Turned on by #1211 (dropping into a column, and moving a row)
describe.skip('moving a row', () => {
  const rowIds = (modal) => modal.state.rows.map((row) => row.id);

  it('moves a row below the next one', async () => {
    const { modal } = await openModal(['text']);
    modal.addRow();
    const [first, second] = rowIds(modal);

    modal.moveRow(first, 1);

    expect(rowIds(modal)).toEqual([second, first]);
  });

  it('moves a row from the keyboard', async () => {
    const { modal } = await openModal(['text']);
    modal.addRow();
    const [first, second] = rowIds(modal);
    modal.selectRow(second);

    modal.moveSelectedRow(-1);

    expect(rowIds(modal)).toEqual([second, first]);
  });

  it('leaves the order alone when a row is dropped where it already is', async () => {
    const { modal } = await openModal(['text']);
    modal.addRow();
    const before = rowIds(modal);

    modal.moveRow(before[0], 0);

    expect(rowIds(modal)).toEqual(before);
  });

  it('holds renders for the duration of a row drag', async () => {
    const { modal } = await openModal(['text']);
    modal.startRowDrag(modal.state.rows[0].id);

    modal.scheduleRender();

    expect(modal.renderHeldDuringDrag).toBe(true);
  });
});

// Turned on by #1212 (duplicating and deleting a row)
describe.skip('duplicating and deleting a row', () => {
  it('puts the copy directly below its source', async () => {
    const { modal } = await openModal(['text']);
    modal.addRow();
    const [first] = modal.state.rows;

    modal.duplicateRow(first.id);

    expect(modal.state.rows).toHaveLength(3);
    expect(modal.state.rows[1].columns[0].elements.map((e) => e.type)).toEqual(
      first.columns[0].elements.map((e) => e.type)
    );
  });

  // A shared id would make the two rows the same row as far as selection and
  // drag are concerned: editing one would appear to edit both.
  it('gives the copy ids of its own, all the way down', async () => {
    const { modal } = await openModal(['text', 'button']);
    const [first] = modal.state.rows;

    modal.duplicateRow(first.id);

    const [source, copy] = modal.state.rows;
    expect(copy.id).not.toBe(source.id);
    const idsOf = (row) =>
      row.columns.flatMap((column) => column.elements.map((e) => e.id));
    expect(idsOf(copy).some((id) => idsOf(source).includes(id))).toBe(false);
  });

  it('copies the values, not a reference to them', async () => {
    const { modal } = await openModal(['text']);
    const [first] = modal.state.rows;
    modal.duplicateRow(first.id);

    modal.state.rows[0].columns[0].elements[0].content = 'changé';

    expect(modal.state.rows[1].columns[0].elements[0].content).not.toBe(
      'changé'
    );
  });

  it('takes the elements of a row with it when it is deleted', async () => {
    const { modal } = await openModal(['text']);
    modal.addRow();
    const [first] = modal.state.rows;

    modal.deleteRow(first.id);

    expect(modal.state.rows).toHaveLength(1);
    expect(shapeOf(modal)).toEqual([[[]]]);
  });

  // Nothing to select, nothing to render, and the modal still has to open.
  it('leaves something that still opens when the last row goes', async () => {
    const { modal } = await openModal(['text']);

    modal.deleteRow(modal.state.rows[0].id);

    expect(modal.state.rows.length).toBeGreaterThanOrEqual(0);
    expect(() => modal.renderPreview()).not.toThrow();
  });

  it('counts a duplication as one undo step', async () => {
    const { modal } = await openModal(['text']);
    modal.duplicateRow(modal.state.rows[0].id);

    modal.apply();

    expect(modal.vm.startMultiple).toHaveBeenCalledTimes(1);
    expect(modal.vm.stopMultiple).toHaveBeenCalledTimes(1);
  });
});
