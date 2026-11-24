/**
 * @jest-environment jsdom
 */

'use strict';

// Duplicating and deleting a row (#1212), against what the modal around them
// guarantees: the row limit, the keys a row and its columns hold, and the
// one selection.

const Vue = require('vue/dist/vue.common');

const { open, unmountAll } = require('./modal-helpers.js');
const {
  MAX_ROWS,
  singleColumnRows,
} = require('../../../packages/shared/block-builder/composition.js');

afterEach(unmountAll);

let count = 0;
/** A row holding one text, so it is written (see withoutEmptyRows). */
const fullRow = () => {
  count += 1;
  return singleColumnRows([
    { id: `el-${count}`, type: 'text', content: 'x' },
  ])[0];
};

/** The modal, opened and holding `n` rows that each hold a text. */
async function withRows(n) {
  const context = open();
  const rows = Array.from({ length: n }, fullRow);
  context.modal.state.rows.splice(0, 1, ...rows);
  context.modal.selectRow(rows[0].id);
  await Vue.nextTick();
  return context;
}

const duplicateButton = () =>
  document.querySelector(
    '.bb-modal__row-actions [aria-label="block-builder-duplicate-row"]'
  );

describe('duplicating a row', () => {
  // A copy is a row too: past MAX_ROWS the composition could not be read back.
  it(`adds nothing past ${MAX_ROWS} rows`, async () => {
    const { modal } = await withRows(MAX_ROWS);

    expect(modal.duplicateRow(modal.state.rows[0].id)).toBeNull();
    expect(modal.state.rows).toHaveLength(MAX_ROWS);
  });

  it(`is disabled at ${MAX_ROWS} rows, and says why`, async () => {
    await withRows(MAX_ROWS);

    expect(duplicateButton().disabled).toBe(true);
    expect(duplicateButton().getAttribute('title')).toBe(
      'block-builder-row-limit'
    );
  });

  it('is enabled below the limit', async () => {
    await withRows(MAX_ROWS - 1);

    expect(duplicateButton().disabled).toBe(false);
    expect(duplicateButton().getAttribute('title')).toBe(
      'block-builder-duplicate-row'
    );
  });

  // As a change of width keeps them (setRowWidths): a key the copy dropped
  // would be a setting lost without anyone asking.
  it('keeps whatever else the row and its columns hold', async () => {
    const { modal } = await withRows(1);
    const [source] = modal.state.rows;
    source.note = 'row';
    source.columns[0].note = 'column';

    const copy = modal.duplicateRow(source.id);

    expect(copy.note).toBe('row');
    expect(copy.columns[0].note).toBe('column');
    expect(copy.id).not.toBe(source.id);
  });
});

describe('deleting a row', () => {
  it('selects nothing once the last row is gone', async () => {
    const { modal } = await withRows(1);

    modal.deleteRow(modal.state.rows[0].id);

    expect(modal.selection).toBeNull();
    expect(modal.selectedRowId).toBeNull();
    expect(modal.selectedElementId).toBeNull();
  });

  it('selects the row that took its place', async () => {
    const { modal } = await withRows(3);
    const [first, second] = modal.state.rows;

    modal.deleteRow(first.id);

    expect(modal.selectedRowId).toBe(second.id);
  });
});
