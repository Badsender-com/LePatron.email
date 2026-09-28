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
  unmountAll,
  layOutRows,
  rowsOf,
  startPaletteDrag,
  dragOverAt,
  dropAt,
  fireIn,
  typesOf,
  dropLineOf,
  ELEMENT_ATTRIBUTE,
  DRAGGING_CLASS,
  DROP_LINE_ID,
  EMPTY_DROP_ID,
} = require('./drag-helpers.js');

afterEach(unmountAll);

describe('the insertion point follows the cursor', () => {
  // The one rule of the HTML5 drag API everybody forgets: without this the
  // browser refuses the drop outright.
  it('cancels dragover, or no drop is possible at all', async () => {
    const { doc } = await openModal(['text']);
    layOutRows(doc, 100);
    startPaletteDrag('image');

    expect(dragOverAt(doc, 10).defaultPrevented).toBe(true);
  });

  // jsdom lays nothing out, so the line's place is read off what it was told:
  // rows of 100px from the top, and a 4px line centred on the edge.
  it('draws the line at the top of the row the element would land before', async () => {
    const { doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);
    startPaletteDrag('image');

    // Above the midpoint of the second row.
    dragOverAt(doc, 120);

    expect(dropLineOf(doc).style.top).toBe('98px');
  });

  it('keeps the line inside the document above the first row', async () => {
    const { doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);
    startPaletteDrag('image');

    dragOverAt(doc, 10);

    expect(dropLineOf(doc).style.top).toBe('0px');
  });

  it('draws it under the last row when the cursor is past everything', async () => {
    const { doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);
    startPaletteDrag('image');

    dragOverAt(doc, 190);

    expect(dropLineOf(doc).style.top).toBe('198px');
  });

  // One element moved around, rather than a class toggled on every row at
  // every dragover — and drawn over the rows, not on them.
  it('moves one line, and leaves the rows alone', async () => {
    const { doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);
    startPaletteDrag('image');
    const classes = rowsOf(doc).map((row) => row.className);

    dragOverAt(doc, 10);
    dragOverAt(doc, 190);

    expect(doc.querySelectorAll(`#${DROP_LINE_ID}`)).toHaveLength(1);
    expect(dropLineOf(doc).parentNode).toBe(doc.body);
    expect(rowsOf(doc).map((row) => row.className)).toEqual(classes);
  });

  it('takes the line away when the drag leaves the preview', async () => {
    const { doc } = await openModal(['text']);
    layOutRows(doc, 100);
    startPaletteDrag('image');
    dragOverAt(doc, 10);

    fireIn(doc, 'dragleave', doc.body);

    expect(dropLineOf(doc)).toBeNull();
  });
});

// The preview holds real images and links, natively draggable, and the browser's
// default for a drop is to open what was dropped — in the iframe, which takes
// the composition away. Files and links dragged in from outside do the same.
//
// The one drag the preview starts is a row's, to move it — an image or a link
// inside a row included (reorder-drag.test.js). Anything else is cancelled.
describe('a drag that is not ours never reaches the browser', () => {
  it('cancels a drag starting outside any row', async () => {
    const { doc } = await openModal([]);

    const event = fireIn(doc, 'dragstart', doc.getElementById(EMPTY_DROP_ID));

    expect(event.defaultPrevented).toBe(true);
  });

  // A text node has no `closest`: what a dragged selection starts from.
  it('cancels a drag of selected text', async () => {
    const { modal, doc } = await openModal(['text']);
    const text = document.createTreeWalker(rowsOf(doc)[0], 4).nextNode();
    expect(text).toBeTruthy();

    const event = fireIn(doc, 'dragstart', text);

    expect(event.defaultPrevented).toBe(true);
    expect(modal.draggingId).toBeNull();
  });

  it('cancels one starting on a row the block does not hold', async () => {
    const { modal, doc } = await openModal(['text']);
    const stray = doc.createElement('div');
    stray.setAttribute(ELEMENT_ATTRIBUTE, 'not-an-element');
    doc.body.appendChild(stray);

    const event = fireIn(doc, 'dragstart', stray);

    expect(event.defaultPrevented).toBe(true);
    expect(modal.draggingId).toBeNull();
  });

  it('refuses it over the preview, without drawing an insertion point', async () => {
    const { doc } = await openModal(['text']);
    layOutRows(doc, 100);

    const event = dragOverAt(doc, 10);

    expect(event.defaultPrevented).toBe(true);
    expect(event.dataTransfer.dropEffect).toBe('none');
    expect(doc.body.classList.contains(DRAGGING_CLASS)).toBe(false);
    expect(dropLineOf(doc)).toBeNull();
  });

  it('cancels its drop, and inserts nothing', async () => {
    const { modal, doc } = await openModal(['text']);
    layOutRows(doc, 100);

    expect(dropAt(doc, 10).defaultPrevented).toBe(true);
    expect(typesOf(modal)).toEqual(['text']);
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
    expect(dropLineOf(doc)).toBeNull();
  });

  it('ignores a drop carrying a type the palette does not offer', async () => {
    const { modal, doc } = await openModal(['text']);
    layOutRows(doc, 100);
    modal.draggingType = 'iframe';

    dropAt(doc, 10);

    expect(modal.state.elements).toHaveLength(1);
  });
});
