/**
 * @jest-environment jsdom
 */

'use strict';

// One selection: an element, a row, or nothing — never an element and a row
// at once.
//
// Every path that selects an element is driven from a row selected first:
// a row and an element selected together is how the panel came to show a
// row's structure beside an element's settings, and a preset clicked then
// changed the row while the user was looking at the element.

const {
  openModal,
  unmountAll,
  rowsOf,
  rowOf,
  layOutRows,
  fireIn,
  moveTo,
  startPaletteDrag,
  dropAt,
} = require('./drag-helpers.js');

afterEach(unmountAll);

/** A real click, bubbling, as a browser delivers it. */
function clickIn(doc, target) {
  target.dispatchEvent(
    new doc.defaultView.MouseEvent('click', { bubbles: true, cancelable: true })
  );
}

/** The modal opened on these elements, with its only row selected. */
async function withRowSelected(types) {
  const context = await openModal(types);
  context.modal.selectRow(context.modal.state.rows[0].id);
  expect(context.modal.selectedRowId).not.toBeNull();
  return context;
}

const expectElementOnly = (modal, id) => {
  expect(modal.selectedElementId).toBe(id);
  expect(modal.selectedRowId).toBeNull();
};

describe('selecting an element unselects the row', () => {
  it('from a click on the palette', async () => {
    const { modal } = await withRowSelected(['text']);

    modal.addElement('button');

    const [button] = modal.state.rows[0].columns[0].elements.filter(
      (element) => element.type === 'button'
    );
    expectElementOnly(modal, button.id);
  });

  it('from a click in the preview', async () => {
    const { modal, doc } = await withRowSelected(['text', 'button']);
    const [, button] = modal.state.rows[0].columns[0].elements;

    clickIn(doc, rowOf(doc, button.id));

    expectElementOnly(modal, button.id);
  });

  it('from a drop of the palette into the preview', async () => {
    const { modal, doc } = await withRowSelected(['text']);
    layOutRows(doc, 100);

    startPaletteDrag('divider');
    dropAt(doc, 150);

    const divider = modal.state.rows[0].columns[0].elements.find(
      (element) => element.type === 'divider'
    );
    expectElementOnly(modal, divider.id);
  });

  it('from picking an element up in the preview', async () => {
    const { modal, doc } = await withRowSelected(['text', 'button']);
    const [text] = modal.state.rows[0].columns[0].elements;

    fireIn(doc, 'dragstart', rowsOf(doc)[0]);

    expectElementOnly(modal, text.id);
  });

  it('from a reorder dropped in the preview', async () => {
    const { modal, doc } = await withRowSelected(['text', 'button']);
    layOutRows(doc, 100);
    const [text] = modal.state.rows[0].columns[0].elements;

    fireIn(doc, 'dragstart', rowsOf(doc)[0]);
    moveTo(doc, 190);

    expectElementOnly(modal, text.id);
  });

  it('from the list', async () => {
    const { modal } = await withRowSelected(['text', 'button']);
    const [, button] = modal.state.rows[0].columns[0].elements;

    modal.selectElement(button.id);

    expectElementOnly(modal, button.id);
  });

  it('from removing an element, which selects its neighbour', async () => {
    const { modal } = await openModal(['text', 'button']);
    const [text, button] = modal.state.rows[0].columns[0].elements;
    modal.selectElement(text.id);

    modal.removeSelected();

    expectElementOnly(modal, button.id);
  });
});

describe('selecting a row unselects the element', () => {
  it('leaves no element selected', async () => {
    const { modal } = await openModal(['text']);
    const [row] = modal.state.rows;

    modal.selectRow(row.id);

    expect(modal.selectedRowId).toBe(row.id);
    expect(modal.selectedElementId).toBeNull();
    expect(modal.selected).toBeNull();
  });
});

describe('a reorder that ends without a drop', () => {
  // It moved nothing, so it changes nothing: the row selected before comes
  // back, rather than the element the drag picked up.
  it('gives the selection back to the row selected before it', async () => {
    const { modal, doc } = await withRowSelected(['text', 'button']);
    const rowId = modal.selectedRowId;

    fireIn(doc, 'dragstart', rowsOf(doc)[0]);
    fireIn(doc, 'dragend', rowsOf(doc)[0]);

    expect(modal.selectedRowId).toBe(rowId);
    expect(modal.selectedElementId).toBeNull();
  });
});

describe('the selection cannot be written around the selectors', () => {
  it('reads selectedElementId and selectedRowId off one state', async () => {
    const { modal } = await openModal(['text']);
    const [row] = modal.state.rows;

    modal.selectRow(row.id);

    expect(modal.selection).toEqual({ kind: 'row', id: row.id, column: 0 });
    expect(
      Object.getOwnPropertyDescriptor(modal.$options.computed, 'selectedRowId')
    ).toBeDefined();
    expect(modal.$options.computed.selectedElementId.set).toBeUndefined();
  });
});
