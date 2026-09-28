/**
 * @jest-environment jsdom
 */

'use strict';

// Reordering by dragging a row of the preview.
//
// The arrows stay — they are the keyboard path and the precise one — but moving
// an element by dragging it is how anyone expects a builder to behave, and it is
// the gesture the arrows make tedious the moment there are more than three
// elements.
//
// The part worth pinning is the arithmetic. A drop index counts rows as they are
// laid out NOW, with the dragged element still among them; taking it out shifts
// everything after it up by one. Get that wrong and dropping an element just
// below itself moves it one row too far — which looks like the feature "almost"
// works, the hardest kind of bug to report.

const {
  openModal,
  rowsOf,
  layOutRows,
  fireIn,
  startPaletteDrag,
  typesOf,
  DRAGGING_CLASS,
  MOVING_CLASS,
} = require('./drag-helpers.js');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('a rendered row can be picked up', () => {
  it('is marked draggable, without that reaching the generated markup', async () => {
    const { modal, doc } = await openModal(['text', 'button']);

    rowsOf(doc).forEach((row) => expect(row.draggable).toBe(true));
    // `draggable` is preview chrome. An email has no use for it.
    expect(modal.html).not.toContain('draggable');
  });

  it('records what is being moved, and says so to the browser', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    const [, second] = modal.state.elements;

    const event = fireIn(doc, 'dragstart', rowsOf(doc)[1]);

    expect(modal.draggingId).toBe(second.id);
    expect(event.dataTransfer.effectAllowed).toBe('move');
    expect(doc.body.classList.contains(DRAGGING_CLASS)).toBe(true);
  });

  // Otherwise the cursor carries something invisible.
  it('dims the row under the cursor', async () => {
    const { doc } = await openModal(['text', 'button']);

    fireIn(doc, 'dragstart', rowsOf(doc)[0]);

    expect(rowsOf(doc)[0].classList.contains(MOVING_CLASS)).toBe(true);
    expect(rowsOf(doc)[1].classList.contains(MOVING_CLASS)).toBe(false);
  });

  // So the settings panel follows the thing being moved.
  it('selects what is being moved', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    const [first] = modal.state.elements;
    modal.selectedId = null;

    fireIn(doc, 'dragstart', rowsOf(doc)[0]);

    expect(modal.selectedId).toBe(first.id);
  });

  it('ignores a drag that did not start on a row', async () => {
    const { modal, doc } = await openModal(['text']);

    fireIn(doc, 'dragstart', doc.body);

    expect(modal.draggingId).toBeNull();
  });
});

describe('the drop moves the element', () => {
  it('moves it up', async () => {
    const { modal, doc } = await openModal(['text', 'button', 'divider']);
    layOutRows(doc, 100);

    fireIn(doc, 'dragstart', rowsOf(doc)[2]);
    fireIn(doc, 'drop', doc.body, 10);

    expect(typesOf(modal)).toEqual(['divider', 'text', 'button']);
  });

  it('moves it down', async () => {
    const { modal, doc } = await openModal(['text', 'button', 'divider']);
    layOutRows(doc, 100);

    fireIn(doc, 'dragstart', rowsOf(doc)[0]);
    fireIn(doc, 'drop', doc.body, 290);

    expect(typesOf(modal)).toEqual(['button', 'divider', 'text']);
  });

  // The off-by-one. Dropping an element just past itself must not skip a row.
  it('lands exactly one place down, not two', async () => {
    const { modal, doc } = await openModal(['text', 'button', 'divider']);
    layOutRows(doc, 100);

    // Past the midpoint of the second row: index 2 in current layout.
    fireIn(doc, 'dragstart', rowsOf(doc)[0]);
    fireIn(doc, 'drop', doc.body, 160);

    expect(typesOf(modal)).toEqual(['button', 'text', 'divider']);
  });

  it('leaves the order alone when dropped where it already is', async () => {
    const { modal, doc } = await openModal(['text', 'button', 'divider']);
    layOutRows(doc, 100);

    fireIn(doc, 'dragstart', rowsOf(doc)[1]);
    fireIn(doc, 'drop', doc.body, 120);

    expect(typesOf(modal)).toEqual(['text', 'button', 'divider']);
  });

  it('keeps the moved element selected', async () => {
    const { modal, doc } = await openModal(['text', 'button', 'divider']);
    layOutRows(doc, 100);
    const [, second] = modal.state.elements;

    fireIn(doc, 'dragstart', rowsOf(doc)[1]);
    fireIn(doc, 'drop', doc.body, 10);

    expect(modal.selectedId).toBe(second.id);
    expect(modal.selected.type).toBe('button');
  });

  it('clears the drag state and the dimming', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);

    fireIn(doc, 'dragstart', rowsOf(doc)[0]);
    fireIn(doc, 'drop', doc.body, 190);

    expect(modal.draggingId).toBeNull();
    expect(doc.body.classList.contains(DRAGGING_CLASS)).toBe(false);
    expect(doc.body.querySelectorAll(`.${MOVING_CLASS}`)).toHaveLength(0);
  });

  // A drag abandoned outside the preview, or cancelled with Escape.
  it('puts everything back when the drag ends without a drop', async () => {
    const { modal, doc } = await openModal(['text', 'button']);

    fireIn(doc, 'dragstart', rowsOf(doc)[0]);
    fireIn(doc, 'dragend', rowsOf(doc)[0]);

    expect(modal.draggingId).toBeNull();
    expect(typesOf(modal)).toEqual(['text', 'button']);
    expect(doc.body.querySelectorAll(`.${MOVING_CLASS}`)).toHaveLength(0);
  });
});

describe('a reorder and an insertion do not get confused', () => {
  it('inserts when the drag came from the palette', async () => {
    const { modal, doc } = await openModal(['text']);
    layOutRows(doc, 100);

    startPaletteDrag('button');
    fireIn(doc, 'drop', doc.body, 10);

    expect(typesOf(modal)).toEqual(['button', 'text']);
  });

  it('moves when the drag came from a row', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);

    fireIn(doc, 'dragstart', rowsOf(doc)[1]);
    fireIn(doc, 'drop', doc.body, 10);

    expect(typesOf(modal)).toEqual(['button', 'text']);
    expect(modal.state.elements).toHaveLength(2);
  });

  // The preview must hold still for a reorder exactly as it does for an
  // insertion: replacing the body destroys the row under the cursor.
  it('holds renders for the duration of a reorder', async () => {
    const { modal, doc } = await openModal(['text', 'button']);

    fireIn(doc, 'dragstart', rowsOf(doc)[0]);
    modal.scheduleRender();

    expect(modal.renderHeldDuringDrag).toBe(true);
  });
});

describe('the arrows still work', () => {
  it('moves the selected element up', async () => {
    const { modal } = await openModal(['text', 'button']);

    modal.move(-1);

    expect(typesOf(modal)).toEqual(['button', 'text']);
  });
});
