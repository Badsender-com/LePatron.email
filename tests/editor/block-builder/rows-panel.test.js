/**
 * @jest-environment jsdom
 */

'use strict';

// The rows panel: the list of rows.
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

function press(target, key) {
  const event = new window.KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

afterEach(unmountAll);

describe('the row list', () => {
  it('names each row by its place and its columns', async () => {
    const modal = await openWith(['text']);
    modal.addRow();
    modal.setRowWidths(modal.state.rows[1].id, [33, 33, 34]);
    await Vue.nextTick();

    expect(rowOptions().map((option) => option.textContent.trim())).toEqual([
      'Ligne 1 · 1 colonne',
      'Ligne 2 · 3 colonnes',
    ]);
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
