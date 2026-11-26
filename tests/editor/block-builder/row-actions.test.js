/**
 * @jest-environment jsdom
 */

'use strict';

// Moving, duplicating and deleting a row from the selected row's bar (#1211,
// #1212), against what the modal around them guarantees: the row limit, the
// keys a row and its columns hold, the one selection, and where the focus
// goes when a button stops working or goes away.

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

const rowButton = (key) =>
  document.querySelector(`.bb-modal__row-actions [aria-label="${key}"]`);
const duplicateButton = () => rowButton('block-builder-duplicate-row');
const upButton = () => rowButton('block-builder-move-row-up');
const downButton = () => rowButton('block-builder-move-row-down');
const deleteButton = () => rowButton('block-builder-delete-row');
const addRowButton = () => document.querySelector('.bb-modal__add-row');

const rowIds = (modal) => modal.state.rows.map((row) => row.id);

/** Clicks, then waits for the render and what runs after it. */
async function press(button) {
  button.focus();
  button.click();
  await Vue.nextTick();
}

// Moving a row with the buttons of its bar: the keyboard path a sighted user
// sees, Alt+↑ and Alt+↓ on the list being the shortcut (rows-panel.test.js).
describe('moving a row with the buttons', () => {
  it('say what they do, in the editor language', async () => {
    await withRows(2);

    [upButton(), downButton()].forEach((button) => {
      expect(button.getAttribute('title')).toBe(
        button.getAttribute('aria-label')
      );
    });
  });

  it('are disabled at the top and the bottom of the list', async () => {
    const { modal } = await withRows(3);

    expect(upButton().disabled).toBe(true);
    expect(downButton().disabled).toBe(false);

    modal.selectRow(modal.state.rows[1].id);
    await Vue.nextTick();
    expect(upButton().disabled).toBe(false);
    expect(downButton().disabled).toBe(false);

    modal.selectRow(modal.state.rows[2].id);
    await Vue.nextTick();
    expect(upButton().disabled).toBe(false);
    expect(downButton().disabled).toBe(true);
  });

  it('move the selected row one place, and keep it selected', async () => {
    const { modal } = await withRows(3);
    const [first, second, third] = rowIds(modal);

    await press(downButton());

    expect(rowIds(modal)).toEqual([second, first, third]);
    expect(modal.selectedRowId).toBe(first);

    await press(upButton());

    expect(rowIds(modal)).toEqual([first, second, third]);
    expect(modal.selectedRowId).toBe(first);
  });

  // A row goes down three places in three presses, without reaching for the
  // button again.
  it('keep the focus on the button pressed while it still works', async () => {
    await withRows(3);

    await press(downButton());

    expect(downButton().disabled).toBe(false);
    expect(document.activeElement).toBe(downButton());
  });

  // A disabled button drops the focus; the other one now works.
  it('hand the focus to the other button at the end of the list', async () => {
    const { modal } = await withRows(2);
    const [first, second] = rowIds(modal);

    await press(downButton());

    expect(rowIds(modal)).toEqual([second, first]);
    expect(downButton().disabled).toBe(true);
    expect(document.activeElement).toBe(upButton());

    await press(upButton());

    expect(rowIds(modal)).toEqual([first, second]);
    expect(document.activeElement).toBe(downButton());
  });
});

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

  // The copy goes all the way down: a value nested in an element, a row or a
  // column is the copy's own, so editing it in one row leaves the other alone.
  it('shares no nested value with its source', async () => {
    const { modal } = await withRows(1);
    const [source] = modal.state.rows;
    const [element] = source.columns[0].elements;
    Vue.set(element, 'padding', { top: 10, sides: [1, 2] });
    Vue.set(source, 'style', { background: '#fff' });

    const copy = modal.duplicateRow(source.id);
    element.padding.top = 20;
    element.padding.sides.push(3);
    source.style.background = '#000';

    expect(copy.columns[0].elements[0].padding).toEqual({
      top: 10,
      sides: [1, 2],
    });
    expect(copy.style).toEqual({ background: '#fff' });
    expect(copy.columns[0].elements[0].id).not.toBe(element.id);
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

  // Done at once, without a confirmation: it looks like what it is.
  it('is styled as a destructive action', async () => {
    await withRows(1);

    expect(deleteButton().classList).toContain('bb-modal__action--destructive');
  });

  // The bar goes with the last row: without this the focus would fall on the
  // body, and a keyboard user would start again from the top of the page.
  it('gives the focus to "Add a row" once the last row is gone', async () => {
    const { modal } = await withRows(1);

    await press(deleteButton());

    expect(modal.state.rows).toHaveLength(0);
    expect(deleteButton()).toBeNull();
    expect(document.activeElement).toBe(addRowButton());
  });

  it('keeps the focus in the bar while a row is left', async () => {
    const { modal } = await withRows(2);
    const [, second] = rowIds(modal);

    await press(deleteButton());

    expect(rowIds(modal)).toEqual([second]);
    expect(document.activeElement).toBe(deleteButton());
  });
});
