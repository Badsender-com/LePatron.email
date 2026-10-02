/**
 * @jest-environment jsdom
 */

'use strict';

// How a reorder ends, and what it leaves for the drag after it.
//
// Picking a row up selects it, so a reorder has a selection to settle when it
// ends: on the moved element after a drop, back where it was after a cancel.
// And the browser does not always say a drag ended — WebKit can lose the
// dragend of a drag that crossed the iframe's edge — so the next drag, of
// either kind, must not inherit the last one's state.
//
// Where a reorder lands is in reorder-drag.test.js.

const {
  openModal,
  unmountAll,
  rowsOf,
  layOutRows,
  fireIn,
  dragOverAt,
  dropAt,
  moveTo,
  startPaletteDrag,
  nextTask,
  typesOf,
  dropLineOf,
  DRAGGING_CLASS,
  MOVING_CLASS,
} = require('./drag-helpers.js');

afterEach(unmountAll);

describe('a reorder ends', () => {
  it('keeps the moved element selected', async () => {
    const { modal, doc } = await openModal(['text', 'button', 'divider']);
    layOutRows(doc, 100);
    const [, second] = modal.state.elements;

    fireIn(doc, 'dragstart', rowsOf(doc)[1]);
    moveTo(doc, 10);
    // The browser fires dragend after the drop: it must not undo the choice.
    fireIn(doc, 'dragend', rowsOf(doc)[0]);

    expect(modal.selectedId).toBe(second.id);
    expect(modal.selected.type).toBe('button');
  });

  it('clears the drag state and the dimming', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);

    fireIn(doc, 'dragstart', rowsOf(doc)[0]);
    await nextTask();
    moveTo(doc, 190);

    expect(modal.draggingId).toBeNull();
    expect(doc.body.classList.contains(DRAGGING_CLASS)).toBe(false);
    expect(doc.body.querySelectorAll(`.${MOVING_CLASS}`)).toHaveLength(0);
    expect(dropLineOf(doc)).toBeNull();
  });

  // A drag abandoned outside the preview, or cancelled with Escape.
  it('puts everything back when the drag ends without a drop', async () => {
    const { modal, doc } = await openModal(['text', 'button']);

    fireIn(doc, 'dragstart', rowsOf(doc)[0]);
    await nextTask();
    fireIn(doc, 'dragend', rowsOf(doc)[0]);

    expect(modal.draggingId).toBeNull();
    expect(typesOf(modal)).toEqual(['text', 'button']);
    expect(doc.body.querySelectorAll(`.${MOVING_CLASS}`)).toHaveLength(0);
  });

  // Picking a row up selects it, so the settings follow it. Put down nowhere,
  // it moved nothing, and the selection should not have moved either.
  it('gives the selection back when the drag ends without a drop', async () => {
    const { modal, doc } = await openModal(['text', 'button', 'divider']);
    const [first] = modal.state.elements;
    modal.selectedId = first.id;

    fireIn(doc, 'dragstart', rowsOf(doc)[2]);
    expect(modal.selected.type).toBe('divider');
    fireIn(doc, 'dragend', rowsOf(doc)[2]);

    expect(modal.selectedId).toBe(first.id);
  });

  it('gives back no selection when there was none', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    modal.selectedId = null;

    fireIn(doc, 'dragstart', rowsOf(doc)[1]);
    fireIn(doc, 'dragend', rowsOf(doc)[1]);

    expect(modal.selectedId).toBeNull();
  });
});

describe('a reorder and an insertion do not get confused', () => {
  it('inserts when the drag came from the palette', async () => {
    const { modal, doc } = await openModal(['text']);
    layOutRows(doc, 100);

    startPaletteDrag('button');
    dragOverAt(doc, 10);
    dropAt(doc, 10);

    expect(typesOf(modal)).toEqual(['button', 'text']);
  });

  it('moves when the drag came from a row', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);

    fireIn(doc, 'dragstart', rowsOf(doc)[1]);
    moveTo(doc, 10);

    expect(typesOf(modal)).toEqual(['button', 'text']);
    expect(modal.state.elements).toHaveLength(2);
  });

  // WebKit can lose the dragend of a drag that crossed the iframe's edge. The
  // reorder's id, left set, would have the next palette drop move the old row
  // instead of inserting.
  it('inserts after a reorder whose dragend never came', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);
    const before = modal.state.elements.map((element) => element.id);

    fireIn(doc, 'dragstart', rowsOf(doc)[1]);
    startPaletteDrag('divider');
    dragOverAt(doc, 10);
    dropAt(doc, 10);

    expect(typesOf(modal)).toEqual(['divider', 'text', 'button']);
    expect(modal.state.elements.slice(1).map((element) => element.id)).toEqual(
      before
    );
    expect(modal.selected.type).toBe('divider');
  });

  it('moves after a palette drag whose dragend never came', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);

    startPaletteDrag('divider');
    await nextTask();
    fireIn(doc, 'dragstart', rowsOf(doc)[1]);

    // The entry the lost drag faded is back as it was.
    expect(modal.draggingType).toBeNull();
    expect(modal.fadedType).toBeNull();
    moveTo(doc, 10);
    expect(typesOf(modal)).toEqual(['button', 'text']);
  });

  // The preview must hold still for a reorder exactly as it does for an
  // insertion: replacing the body destroys the row under the cursor.
  it('holds renders for the duration of a reorder', async () => {
    const { modal, doc } = await openModal(['text', 'button']);

    fireIn(doc, 'dragstart', rowsOf(doc)[0]);
    modal.scheduleRender();

    expect(modal.renderHeld).toBe(true);
  });
});
