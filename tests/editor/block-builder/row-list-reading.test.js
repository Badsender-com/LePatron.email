/**
 * @jest-environment jsdom
 */

'use strict';

// What the row list says while the user works in a row.
//
// A row was named by its first element only: a row holding a text, an image
// and a button read "Texte — Un titre…", and nothing said the other two were
// there. And selecting an element unselected its row, so the list showed no
// row at all while the user was working inside one. A row now says how many
// more elements it holds, and the row of the selected element stays marked.
//
// Through the French dictionary, as rows-panel.test.js does.

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

afterEach(unmountAll);

describe('a row’s name', () => {
  it('counts the elements after the first', async () => {
    const modal = await openWith(['text', 'image', 'button']);
    modal.state.rows[0].columns[0].elements[0].content = '<p>Bonjour</p>';
    await Vue.nextTick();

    expect(rowOptions()[0].textContent.trim()).toBe(
      'Ligne 1 · 1 colonne — Texte — Bonjour +2'
    );
  });

  it('counts across the columns of the row', async () => {
    const modal = await openWith(['button', 'divider']);
    const [row] = modal.state.rows;
    modal.setRowWidths(row.id, [50, 50]);
    const [divider] = row.columns[0].elements.splice(1, 1);
    row.columns[1].elements.push(divider);
    await Vue.nextTick();

    expect(rowOptions()[0].textContent.trim()).toBe(
      'Ligne 1 · 2 colonnes — Bouton — vide +1'
    );
  });

  // The whole name, when the list is too narrow to show it.
  it('is its tooltip too', async () => {
    const modal = await openWith(['text', 'image']);
    await Vue.nextTick();

    expect(rowOptions()[0].getAttribute('title')).toBe(
      rowOptions()[0].textContent.trim()
    );
    expect(modal.state.rows).toHaveLength(1);
  });
});

describe('the row of the selected element', () => {
  it('stays marked in the list', async () => {
    const modal = await openWith(['text']);
    modal.addRow();
    const button = modal.addElement('button');
    await Vue.nextTick();

    modal.selectElement(button.id);
    await Vue.nextTick();

    const [first, second] = rowOptions();
    expect(second.classList.contains('bb-modal__row--current')).toBe(true);
    expect(first.classList.contains('bb-modal__row--current')).toBe(false);
    // Marked, not selected: the listbox has one selection, the element's.
    expect(second.getAttribute('aria-selected')).toBe('false');
  });

  it('is not marked once the row itself is selected', async () => {
    const modal = await openWith(['text']);
    modal.selectRow(modal.state.rows[0].id);
    await Vue.nextTick();

    expect(rowOptions()[0].classList.contains('bb-modal__row--current')).toBe(
      false
    );
    expect(rowOptions()[0].classList.contains('bb-modal__row--on')).toBe(true);
  });
});
