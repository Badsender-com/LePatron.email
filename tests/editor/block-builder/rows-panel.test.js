/**
 * @jest-environment jsdom
 */

'use strict';

// The rows panel: the list of rows, and the structure of the selected one —
// its presets, and what it says when a column disappears (#1210). The bar that
// sets its widths and gutters is row-layout-panel.test.js.
//
// Through the French dictionary, substituted as the editor does (`vm.tt`), so
// a label is read as a user reads it.

const Vue = require('vue/dist/vue.common');

const { open, unmountAll } = require('./modal-helpers.js');
const fr = require('../../../public/lang/badsender-fr.js');

const t = (key, params) =>
  Object.keys(params || {}).reduce(
    (text, name) => text.replace(new RegExp(`__${name}__`, 'g'), params[name]),
    fr[key] || key
  );

async function openWith(types) {
  const { modal } = open(null, { t, showDialogGallery: () => false });
  types.forEach((type) => modal.addElement(type));
  await Vue.nextTick();
  return modal;
}

const rowOptions = () =>
  Array.from(document.querySelectorAll('.bb-modal__rows [role="option"]'));
const foldedText = () =>
  document.querySelector('.bb-modal__folded').textContent.trim();

function press(target, key, modifiers) {
  const event = new window.KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  target.dispatchEvent(event);
  return event;
}

/** Puts an element of the first column into another one of the same row. */
function placeIn(modal, columnIndex) {
  const [row] = modal.state.rows;
  const [element] = row.columns[0].elements.splice(-1, 1);
  row.columns[columnIndex].elements.push(element);
}

afterEach(unmountAll);

describe('the row list', () => {
  it('names each row by its place and its columns', async () => {
    const modal = await openWith(['text']);
    modal.addRow();
    modal.setRowWidths(modal.state.rows[1].id, [33, 33, 34]);
    await Vue.nextTick();

    expect(rowOptions().map((option) => option.textContent.trim())).toEqual([
      'Ligne 1 · 1 colonne — Texte',
      'Ligne 2 · 3 colonnes — vide',
    ]);
  });

  // Place and structure alone read the same for a row and its copy, or for
  // two rows swapped: the first element tells them apart, in the words of the
  // element list.
  it('names each row by its first element too', async () => {
    const modal = await openWith(['text']);
    modal.state.rows[0].columns[0].elements[0].content = '<p>Bonjour</p>';
    modal.addRow();
    modal.addElement('button');
    modal.state.rows[1].columns[0].elements[0].label = 'Acheter';
    await Vue.nextTick();

    expect(rowOptions().map((option) => option.textContent.trim())).toEqual([
      'Ligne 1 · 1 colonne — Texte — Bonjour',
      'Ligne 2 · 1 colonne — Bouton — Acheter',
    ]);
  });

  // The first in document order: column by column, so an empty first column
  // hands over to the next.
  it('takes the first element of the row, whatever column holds it', async () => {
    const modal = await openWith(['button']);
    modal.setRowWidths(modal.state.rows[0].id, [50, 50]);
    placeIn(modal, 1);
    await Vue.nextTick();

    expect(rowOptions()[0].textContent.trim()).toBe(
      'Ligne 1 · 2 colonnes — Bouton'
    );
  });

  // The dictionary substitutes with String#replace, which would read `$&` in
  // a user's text as "the matched placeholder".
  it('shows a dollar sign in the text as typed', async () => {
    const modal = await openWith(['text']);
    modal.state.rows[0].columns[0].elements[0].content = '<p>5 $& 6 $$</p>';
    await Vue.nextTick();

    expect(rowOptions()[0].textContent.trim()).toBe(
      'Ligne 1 · 1 colonne — Texte — 5 $& 6 $$'
    );
  });

  // One Tab stop for the whole list, as the element list below it.
  it('puts the only tab stop on the selected row, or the first', async () => {
    const modal = await openWith(['text']);
    modal.addRow();
    modal.addRow();
    modal.selectElement(modal.state.rows[0].columns[0].elements[0].id);
    await Vue.nextTick();

    expect(rowOptions().map((option) => option.tabIndex)).toEqual([0, -1, -1]);

    modal.selectRow(modal.state.rows[2].id);
    await Vue.nextTick();

    expect(rowOptions().map((option) => option.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('selects with Enter and with Space', async () => {
    const modal = await openWith(['text']);
    modal.addRow();
    await Vue.nextTick();
    const [first, second] = modal.state.rows;

    expect(press(rowOptions()[0], 'Enter').defaultPrevented).toBe(true);
    expect(modal.selectedRowId).toBe(first.id);

    expect(press(rowOptions()[1], ' ').defaultPrevented).toBe(true);
    expect(modal.selectedRowId).toBe(second.id);
  });

  it('walks the rows with the arrows, focus following', async () => {
    const modal = await openWith(['text']);
    modal.addRow();
    modal.addRow();
    modal.selectRow(modal.state.rows[2].id);
    await Vue.nextTick();

    press(rowOptions()[2], 'ArrowUp');
    await Vue.nextTick();

    expect(modal.selectedRowId).toBe(modal.state.rows[1].id);
    expect(document.activeElement).toBe(rowOptions()[1]);

    press(rowOptions()[1], 'ArrowDown');
    await Vue.nextTick();

    expect(modal.selectedRowId).toBe(modal.state.rows[2].id);
    expect(document.activeElement).toBe(rowOptions()[2]);
  });

  it('stops at the ends of the list', async () => {
    const modal = await openWith(['text']);
    modal.addRow();
    await Vue.nextTick();
    const last = modal.state.rows[1];

    press(rowOptions()[1], 'ArrowDown');

    expect(modal.selectedRowId).toBe(last.id);
  });

  // The two lists share the motif, and neither walks into the other.
  it('leaves the element list alone', async () => {
    const modal = await openWith(['text', 'button']);
    modal.addRow();
    modal.selectRow(modal.state.rows[0].id);
    await Vue.nextTick();

    press(rowOptions()[0], 'ArrowDown');
    await Vue.nextTick();

    expect(document.activeElement).toBe(rowOptions()[1]);
    expect(modal.selectedElementId).toBeNull();
  });
});

// Moving a row from the keyboard (#1211). The arrows alone walk the list, as
// in the element list, so moving takes Alt with them.
describe('moving a row from the keyboard', () => {
  const rowIds = (modal) => modal.state.rows.map((row) => row.id);

  async function threeRows() {
    const modal = await openWith(['text']);
    modal.addRow();
    modal.addRow();
    await Vue.nextTick();
    return modal;
  }

  it('moves the row up with Alt and the up arrow, focus going with it', async () => {
    const modal = await threeRows();
    const [first, second, third] = rowIds(modal);

    expect(
      press(rowOptions()[2], 'ArrowUp', { altKey: true }).defaultPrevented
    ).toBe(true);
    await Vue.nextTick();

    expect(rowIds(modal)).toEqual([first, third, second]);
    expect(modal.selectedRowId).toBe(third);
    expect(document.activeElement).toBe(rowOptions()[1]);
  });

  it('moves the row down with Alt and the down arrow', async () => {
    const modal = await threeRows();
    const [first, second, third] = rowIds(modal);

    press(rowOptions()[0], 'ArrowDown', { altKey: true });
    await Vue.nextTick();

    expect(rowIds(modal)).toEqual([second, first, third]);
    expect(modal.selectedRowId).toBe(first);
    expect(document.activeElement).toBe(rowOptions()[1]);
  });

  it('leaves the order alone on an arrow without Alt', async () => {
    const modal = await threeRows();
    const before = rowIds(modal);

    press(rowOptions()[2], 'ArrowUp');
    press(rowOptions()[0], 'ArrowDown');
    await Vue.nextTick();

    expect(rowIds(modal)).toEqual(before);
  });

  it('stops at the ends of the list', async () => {
    const modal = await threeRows();
    const before = rowIds(modal);

    press(rowOptions()[0], 'ArrowUp', { altKey: true });
    press(rowOptions()[2], 'ArrowDown', { altKey: true });
    await Vue.nextTick();

    expect(rowIds(modal)).toEqual(before);
  });

  it('announces the shortcut on each row', async () => {
    await threeRows();

    rowOptions().forEach((option) => {
      expect(option.getAttribute('aria-keyshortcuts')).toBe(
        'Alt+ArrowUp Alt+ArrowDown'
      );
    });
  });
});

describe('a change of structure', () => {
  it('keeps whatever else a column holds', async () => {
    const modal = await openWith(['text']);
    const [row] = modal.state.rows;
    modal.setRowWidths(row.id, [50, 50]);
    modal.state.rows[0].columns[0].background = '#ffcc00';

    modal.setRowWidths(row.id, [66, 34]);

    expect(modal.state.rows[0].columns[0]).toEqual(
      expect.objectContaining({ width: 396, background: '#ffcc00' })
    );
  });

  // The preset already active, clicked again: nothing to rebuild, and nothing
  // for the preview to redraw.
  it('leaves the row alone when the widths are the ones it has', async () => {
    const modal = await openWith(['text']);
    const [row] = modal.state.rows;
    modal.setRowWidths(row.id, [50, 50]);
    const columns = modal.state.rows[0].columns;

    expect(modal.setRowWidths(row.id, [50, 50])).toBe(false);
    expect(modal.state.rows[0].columns).toBe(columns);
  });

  // The preview watches its markup: asking for a render as well would redraw
  // the iframe even when the markup did not move.
  it('leaves the render to the preview', async () => {
    const modal = await openWith(['text']);
    const render = jest.spyOn(modal, 'scheduleRender');

    modal.setRowWidths(modal.state.rows[0].id, [50, 50]);

    expect(render).not.toHaveBeenCalled();
  });
});

// The criterion of #1210: the elements of a column that disappears are kept,
// and the user is told where they went.
describe('the elements of a column that disappears', () => {
  async function thirdsHoldingTwo() {
    const modal = await openWith(['text', 'button', 'divider']);
    const [row] = modal.state.rows;
    modal.selectRow(row.id);
    modal.setRowWidths(row.id, [33, 33, 34]);
    placeIn(modal, 2);
    placeIn(modal, 2);
    await Vue.nextTick();
    return modal;
  }

  it('are counted, with the column they went to', async () => {
    const modal = await thirdsHoldingTwo();

    modal.setRowWidths(modal.state.rows[0].id, [50, 50]);
    await Vue.nextTick();

    expect(foldedText()).toBe('2 éléments déplacés dans la colonne 2.');
    expect(
      modal.state.rows[0].columns[1].elements.map((element) => element.type)
    ).toEqual(['divider', 'button']);
  });

  it('are counted in the singular when there is one', async () => {
    const modal = await openWith(['text', 'button']);
    const [row] = modal.state.rows;
    modal.selectRow(row.id);
    modal.setRowWidths(row.id, [50, 50]);
    placeIn(modal, 1);

    modal.setRowWidths(row.id, [100]);
    await Vue.nextTick();

    expect(foldedText()).toBe('1 élément déplacé dans la colonne 1.');
  });

  it('is said in a region a screen reader announces', async () => {
    await thirdsHoldingTwo();

    expect(
      document.querySelector('.bb-modal__folded').getAttribute('role')
    ).toBe('status');
  });

  it('is not said when a column that goes held nothing', async () => {
    const modal = await openWith(['text']);
    const [row] = modal.state.rows;
    modal.selectRow(row.id);
    modal.setRowWidths(row.id, [50, 50]);

    modal.setRowWidths(row.id, [100]);
    await Vue.nextTick();

    expect(foldedText()).toBe('');
  });

  it('is no longer said after the next change', async () => {
    const modal = await thirdsHoldingTwo();
    const [row] = modal.state.rows;
    modal.setRowWidths(row.id, [50, 50]);

    modal.setRowWidths(row.id, [66, 34]);
    await Vue.nextTick();

    expect(foldedText()).toBe('');
  });

  it('is no longer said once another row is selected', async () => {
    const modal = await thirdsHoldingTwo();
    modal.setRowWidths(modal.state.rows[0].id, [50, 50]);
    // Selects the new row.
    modal.addRow();
    await Vue.nextTick();

    modal.selectRow(modal.state.rows[0].id);
    await Vue.nextTick();

    expect(foldedText()).toBe('');
  });
});
