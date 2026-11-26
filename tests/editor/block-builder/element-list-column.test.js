/**
 * @jest-environment jsdom
 */

'use strict';

// The element list says which column it shows. It shows the active column
// (selection.js), and a list of two texts reads the same whatever column it
// came from: once the block has more than one column, a title above the list
// names it, "Ligne 1 · Colonne 2". A block of one column has no other to
// mistake it for, and says nothing more.
//
// Through the French dictionary, substituted as the editor does (`vm.tt`), so
// the title is read as a user reads it.

const Vue = require('vue/dist/vue.common');

const { open, unmountAll } = require('./modal-helpers.js');
const fr = require('../../../public/lang/badsender-fr.js');

const t = (key, params) =>
  Object.keys(params || {}).reduce(
    (text, name) => text.replace(new RegExp(`__${name}__`, 'g'), params[name]),
    fr[key] || key
  );

afterEach(unmountAll);

async function openWith(types) {
  const { modal } = open(null, { t, showDialogGallery: () => false });
  types.forEach((type) => modal.addElement(type));
  await Vue.nextTick();
  return modal;
}

const title = () => document.querySelector('.bb-modal__list-column');
const list = () => document.querySelector('.bb-modal__list');

describe('the title of the element list', () => {
  it('is absent for a block of one column', async () => {
    await openWith(['text']);

    expect(title()).toBeNull();
    expect(list().getAttribute('aria-labelledby').split(' ')).toHaveLength(1);
  });

  it('names the row and the column the list shows', async () => {
    const modal = await openWith(['text', 'button']);
    const [row] = modal.state.rows;
    modal.setRowWidths(row.id, [50, 50]);
    const button = row.columns[0].elements[1];
    modal.moveElement(button.id, { rowId: row.id, columnIndex: 1, index: 0 });

    modal.selectElement(row.columns[0].elements[0].id);
    await Vue.nextTick();
    expect(title().textContent.trim()).toBe('Ligne 1 · Colonne 1');

    modal.selectElement(button.id);
    await Vue.nextTick();
    expect(title().textContent.trim()).toBe('Ligne 1 · Colonne 2');
  });

  // Two rows of one column each are two columns to choose from all the same.
  it('names the row of a block of single-column rows', async () => {
    const modal = await openWith(['text']);
    const second = modal.addRow();
    await Vue.nextTick();

    expect(modal.selectedRowId).toBe(second.id);
    expect(title().textContent.trim()).toBe('Ligne 2 · Colonne 1');
  });

  it('shows above an empty column too', async () => {
    const modal = await openWith(['text']);
    modal.setRowWidths(modal.state.rows[0].id, [50, 50]);
    modal.addRow();
    await Vue.nextTick();

    expect(title().textContent.trim()).toBe('Ligne 2 · Colonne 1');
    expect(document.querySelector('.bb-modal__empty')).not.toBeNull();
  });

  // A screen reader hears the column with the list, not only the section.
  it('labels the list along with its section', async () => {
    const modal = await openWith(['text']);
    modal.setRowWidths(modal.state.rows[0].id, [50, 50]);
    await Vue.nextTick();

    const ids = list().getAttribute('aria-labelledby').split(' ');
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[1])).toBe(title());
  });
});
