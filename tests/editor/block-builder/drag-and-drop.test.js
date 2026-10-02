/**
 * @jest-environment jsdom
 */

'use strict';

// Dragging an element from the palette into the preview.
//
// The paradigm it replaces — a "+ Texte" button and a pair of arrows — works,
// but it is not what anyone recognises as an email builder, and it could not be
// shown to a client. What is pinned here is the behaviour that makes the drag
// usable rather than merely present:
//
//   - the drop lands WHERE the cursor is, not at the end;
//   - a dropped element is selected, so it is editable without a second
//     gesture.
//
// Starting the drag is in drag-start.test.js; what the preview does around it
// — holding still, the empty block, what never reaches the block — is in
// preview-during-drag.test.js.

const {
  openModal,
  layOutRows,
  rowsOf,
  startPaletteDrag,
  dragOverAt,
  dropAt,
  typesOf,
  DRAGGING_CLASS,
  DROP_BEFORE_CLASS,
  DROP_AFTER_CLASS,
} = require('./drag-helpers.js');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the insertion point follows the cursor', () => {
  // The one rule of the HTML5 drag API everybody forgets: without this the
  // browser refuses the drop outright.
  it('cancels dragover, or no drop is possible at all', async () => {
    const { doc } = await openModal(['text']);
    layOutRows(doc, 100);
    startPaletteDrag('image');

    expect(dragOverAt(doc, 10).defaultPrevented).toBe(true);
  });

  it('ignores a drag that did not start in our palette', async () => {
    const { doc } = await openModal(['text']);
    layOutRows(doc, 100);

    expect(dragOverAt(doc, 10).defaultPrevented).toBe(false);
  });

  it('marks the row the element would land before', async () => {
    const { doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);
    startPaletteDrag('image');

    // Above the midpoint of the second row.
    dragOverAt(doc, 120);

    expect(rowsOf(doc)[1].classList.contains(DROP_BEFORE_CLASS)).toBe(true);
    expect(rowsOf(doc)[0].classList.contains(DROP_BEFORE_CLASS)).toBe(false);
  });

  it('marks the last row below it when the cursor is past everything', async () => {
    const { doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);
    startPaletteDrag('image');

    dragOverAt(doc, 190);

    expect(rowsOf(doc)[1].classList.contains(DROP_AFTER_CLASS)).toBe(true);
  });

  it('shows one indicator at a time', async () => {
    const { doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);
    startPaletteDrag('image');

    dragOverAt(doc, 10);
    dragOverAt(doc, 190);

    expect(doc.body.querySelectorAll(`.${DROP_BEFORE_CLASS}`)).toHaveLength(0);
    expect(doc.body.querySelectorAll(`.${DROP_AFTER_CLASS}`)).toHaveLength(1);
  });
});

describe('dropping', () => {
  it('inserts at the cursor, not at the end', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);
    startPaletteDrag('divider');

    // Above the midpoint of the first row: before everything.
    dropAt(doc, 10);

    expect(typesOf(modal)).toEqual(['divider', 'text', 'button']);
  });

  it('inserts between two elements', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);
    startPaletteDrag('divider');

    dropAt(doc, 120);

    expect(typesOf(modal)).toEqual(['text', 'divider', 'button']);
  });

  it('appends when dropped past the last element', async () => {
    const { modal, doc } = await openModal(['text']);
    layOutRows(doc, 100);
    startPaletteDrag('spacer');

    dropAt(doc, 90);

    expect(typesOf(modal)).toEqual(['text', 'spacer']);
  });

  // Dropping and editing should be one gesture, not two.
  it('selects what was dropped', async () => {
    const { modal, doc } = await openModal(['text']);
    layOutRows(doc, 100);
    startPaletteDrag('button');

    dropAt(doc, 90);

    expect(modal.selected.type).toBe('button');
  });

  it('clears the drag state and every indicator', async () => {
    const { modal, doc } = await openModal(['text']);
    layOutRows(doc, 100);
    startPaletteDrag('button');
    dragOverAt(doc, 10);

    dropAt(doc, 10);

    expect(modal.draggingType).toBeNull();
    expect(doc.body.classList.contains(DRAGGING_CLASS)).toBe(false);
    expect(doc.body.querySelectorAll(`.${DROP_BEFORE_CLASS}`)).toHaveLength(0);
  });

  it('ignores a drop carrying a type the palette does not offer', async () => {
    const { modal, doc } = await openModal(['text']);
    layOutRows(doc, 100);
    modal.draggingType = 'iframe';

    dropAt(doc, 10);

    expect(modal.state.elements).toHaveLength(1);
  });
});
