/**
 * @jest-environment jsdom
 */

'use strict';

// The panel on the right sets whatever is selected: an element, or a row.
//
// The row's settings — its actions, its structure, the bar of its widths and
// gutters, its stack spacing — used to sit in the left column, under the
// palette and the row list, in 220px that had to scroll, while the panel on
// the right stood empty with "select an element". They now take that panel
// when a row is selected; an element's settings say where the element sits,
// and lead back to its row.

const Vue = require('vue/dist/vue.common');

const { openModal, unmountAll } = require('./drag-helpers.js');

afterEach(unmountAll);

// Through the document: the modal's root is not always an element.
const left = () => document.querySelector('.bb-modal__column--left');
const right = () => document.querySelector('.bb-modal__column--right');

async function withHalves() {
  const context = await openModal(['text']);
  const { modal } = context;
  const row = modal.addRow();
  modal.setRowWidths(row.id, [50, 50]);
  await Vue.nextTick();
  return { ...context, row: modal.rowById(row.id) };
}

describe('with a row selected', () => {
  it('shows the row’s structure on the right, not on the left', async () => {
    const { modal } = await withHalves();

    expect(right(modal).querySelector('.bb-modal__structure')).not.toBeNull();
    expect(left(modal).querySelector('.bb-modal__structure')).toBeNull();
  });

  it('shows the row’s actions on the right', async () => {
    const { modal } = await withHalves();

    expect(right(modal).querySelector('.bb-modal__row-actions')).not.toBeNull();
    expect(left(modal).querySelector('.bb-modal__row-actions')).toBeNull();
  });

  it('offers each column to add into, and says which one is chosen', async () => {
    const { modal, row } = await withHalves();
    const choices = () =>
      right(modal).querySelectorAll('.bb-modal__column-choice');

    expect(choices()).toHaveLength(2);
    expect(choices()[0].getAttribute('aria-pressed')).toBe('true');

    choices()[1].click();
    await Vue.nextTick();

    expect(modal.activeColumn).toBe(row.columns[1]);
    expect(choices()[1].getAttribute('aria-pressed')).toBe('true');
    expect(choices()[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('offers no column to choose in a row of one', async () => {
    const { modal } = await openModal(['text']);
    modal.selectRow(modal.state.rows[0].id);
    await Vue.nextTick();

    expect(
      right(modal).querySelectorAll('.bb-modal__column-choice')
    ).toHaveLength(0);
  });
});

describe('with an element selected', () => {
  it('shows the element’s settings and where it sits', async () => {
    const { modal } = await withHalves();
    const [text] = modal.state.rows[0].columns[0].elements;

    modal.selectElement(text.id);
    await Vue.nextTick();

    expect(right(modal).querySelector('.bb-modal__structure')).toBeNull();
    expect(
      right(modal).querySelector('.bb-modal__place').textContent
    ).toContain('block-builder-elements-column');
  });

  it('leads back to its row, with its column chosen', async () => {
    const { modal, row } = await withHalves();
    const button = modal.insertElement('button', {
      rowId: row.id,
      columnIndex: 1,
      index: 0,
    });
    await Vue.nextTick();

    right(modal).querySelector('.bb-modal__place-row').click();
    await Vue.nextTick();

    expect(modal.selectedElementId).toBeNull();
    expect(modal.selectedRowId).toBe(row.id);
    expect(modal.activeColumn).toBe(row.columns[1]);
    expect(modal.activeColumn.elements[0]).toBe(button);
  });
});

describe('with nothing selected', () => {
  it('asks for a selection', async () => {
    const { modal } = await openModal([]);
    modal.selectElement(null);
    await Vue.nextTick();

    expect(right(modal).textContent).toContain('block-builder-select-element');
  });
});
