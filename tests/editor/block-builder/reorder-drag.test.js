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
//
// How a reorder ends — the selection it settles, the drag after a lost dragend
// — is in reorder-drag-endings.test.js.

const {
  openModal,
  unmountAll,
  rowsOf,
  layOutRows,
  fireIn,
  dragOverAt,
  startPaletteDrag,
  dragOverPage,
  nextTask,
  typesOf,
  dropLineOf,
  moveTo,
  ELEMENT_ATTRIBUTE,
  DRAGGING_CLASS,
  MOVING_CLASS,
} = require('./drag-helpers.js');

// Duplicated, like the class names in drag-helpers.js: a test that imported it
// could not notice it being changed back to something TinyMCE pastes.
const DRAG_TYPE = 'application/x-lp-block-builder';

afterEach(unmountAll);

describe('a rendered row can be picked up', () => {
  it('is marked draggable', async () => {
    const { doc } = await openModal(['text', 'button']);

    rowsOf(doc).forEach((row) => expect(row.draggable).toBe(true));
  });

  // `draggable`, the element ids and the lp-bb- classes are preview chrome,
  // set on the very rows the drag moves. An email has no use for any of it,
  // whatever path the markup takes to the block.
  it('leaves no preview chrome in what Apply writes after a reorder', async () => {
    const { modal, doc, markup } = await openModal(['text', 'button', 'image']);
    layOutRows(doc, 100);
    fireIn(doc, 'dragstart', rowsOf(doc)[2]);
    await nextTask();
    moveTo(doc, 10);
    expect(typesOf(modal)).toEqual(['image', 'text', 'button']);

    modal.handleApply();

    const written = markup();
    expect(written).toContain('<img');
    expect(written).not.toContain('draggable');
    expect(written).not.toContain('data-lp-el');
    expect(written).not.toContain('lp-bb-');
  });

  // Nothing else says a row can be moved before someone tries.
  it('shows a grab cursor on the rows, and a grabbing one during a drag', async () => {
    const { doc } = await openModal(['text']);
    const css = doc.querySelector('style').textContent;

    expect(css).toContain(`[${ELEMENT_ATTRIBUTE}]{cursor:grab;`);
    expect(css).toContain(
      `body.${DRAGGING_CLASS} [${ELEMENT_ATTRIBUTE}]{cursor:grabbing;}`
    );
  });

  // Set on the nodes, so every render has to set it again.
  it('is still draggable after the preview renders again', async () => {
    const { modal, doc } = await openModal(['text']);

    modal.addElement('button');
    modal.renderPreview();

    expect(rowsOf(doc)).toHaveLength(2);
    rowsOf(doc).forEach((row) => expect(row.draggable).toBe(true));
  });

  // Otherwise the browser picks up the image or the link, and the cursor
  // carries a picture of that, or its URL, instead of the row.
  it('leaves the row as the only thing in it to drag', async () => {
    const { doc } = await openModal(['image', 'button']);

    expect(doc.body.querySelector('img').draggable).toBe(false);
    expect(doc.body.querySelector('a').draggable).toBe(false);
  });

  it('records what is being moved, and says so to the browser', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    const [, second] = modal.state.elements;

    const event = fireIn(doc, 'dragstart', rowsOf(doc)[1]);

    expect(event.defaultPrevented).toBe(false);
    expect(modal.draggingId).toBe(second.id);
    expect(event.dataTransfer.effectAllowed).toBe('move');
    expect(doc.body.classList.contains(DRAGGING_CLASS)).toBe(true);
  });

  // Released over the settings panel's TinyMCE field, a `text/plain` would be
  // pasted there: the element id, as text.
  it('carries nothing a text field would paste', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    const [first] = modal.state.elements;

    const event = fireIn(doc, 'dragstart', rowsOf(doc)[0]);

    expect(event.dataTransfer.data).toEqual({ [DRAG_TYPE]: first.id });
  });

  // An image or a link a browser lets start the drag anyway moves its row.
  it('picks up the row when the drag starts on its image or link', async () => {
    const { modal, doc } = await openModal(['image', 'button']);
    const [image, button] = modal.state.elements;

    const fromImage = fireIn(doc, 'dragstart', doc.body.querySelector('img'));
    expect(fromImage.defaultPrevented).toBe(false);
    expect(modal.draggingId).toBe(image.id);
    modal.handleDragEnd();

    fireIn(doc, 'dragstart', doc.body.querySelector('a'));
    expect(modal.draggingId).toBe(button.id);
  });

  it('says it is a move, over the preview', async () => {
    const { doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);

    fireIn(doc, 'dragstart', rowsOf(doc)[0]);
    const over = dragOverAt(doc, 190);

    expect(over.defaultPrevented).toBe(true);
    expect(over.dataTransfer.dropEffect).toBe('move');
    expect(dropLineOf(doc)).toBeTruthy();
  });

  // Mosaico cancels dragover on the whole editor window, which would have the
  // page accept the row anywhere once it leaves the iframe.
  it('refuses the drop outside the preview, and says so', async () => {
    const { doc } = await openModal(['text', 'button']);
    fireIn(doc, 'dragstart', rowsOf(doc)[0]);

    const over = dragOverPage();

    expect(over.defaultPrevented).toBe(true);
    expect(over.dataTransfer.dropEffect).toBe('none');
  });

  // Otherwise the cursor carries something invisible — but only once the
  // browser has taken its picture, or the ghost comes out dimmed too.
  it('dims the row under the cursor, after the drag image is taken', async () => {
    const { doc } = await openModal(['text', 'button']);

    fireIn(doc, 'dragstart', rowsOf(doc)[0]);
    expect(rowsOf(doc)[0].classList.contains(MOVING_CLASS)).toBe(false);
    await nextTask();

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

    const event = fireIn(doc, 'dragstart', doc.body);

    expect(event.defaultPrevented).toBe(true);
    expect(modal.draggingId).toBeNull();
  });
});

describe('the drop moves the element', () => {
  it('moves it up', async () => {
    const { modal, doc } = await openModal(['text', 'button', 'divider']);
    layOutRows(doc, 100);

    fireIn(doc, 'dragstart', rowsOf(doc)[2]);
    moveTo(doc, 10);

    expect(typesOf(modal)).toEqual(['divider', 'text', 'button']);
  });

  it('moves it down', async () => {
    const { modal, doc } = await openModal(['text', 'button', 'divider']);
    layOutRows(doc, 100);

    fireIn(doc, 'dragstart', rowsOf(doc)[0]);
    moveTo(doc, 290);

    expect(typesOf(modal)).toEqual(['button', 'divider', 'text']);
  });

  // The off-by-one. Dropping an element just past itself must not skip a row.
  it('lands exactly one place down, not two', async () => {
    const { modal, doc } = await openModal(['text', 'button', 'divider']);
    layOutRows(doc, 100);

    // Past the midpoint of the second row: index 2 in current layout.
    fireIn(doc, 'dragstart', rowsOf(doc)[0]);
    moveTo(doc, 160);

    expect(typesOf(modal)).toEqual(['button', 'text', 'divider']);
  });

  it('leaves the order alone when dropped where it already is', async () => {
    const { modal, doc } = await openModal(['text', 'button', 'divider']);
    layOutRows(doc, 100);

    fireIn(doc, 'dragstart', rowsOf(doc)[1]);
    moveTo(doc, 120);

    expect(typesOf(modal)).toEqual(['text', 'button', 'divider']);
  });

  // Just above the row or just below it, a drop changes nothing: a line there
  // would promise a move that does not happen.
  it('draws no line on the edges of the row being moved', async () => {
    const { doc } = await openModal(['text', 'button', 'divider']);
    layOutRows(doc, 100);
    fireIn(doc, 'dragstart', rowsOf(doc)[1]);

    // Above the middle row's midpoint, then past it: positions 1 and 2.
    dragOverAt(doc, 120);
    expect(dropLineOf(doc)).toBeNull();
    dragOverAt(doc, 160);
    expect(dropLineOf(doc)).toBeNull();

    // One row further either way is a real move.
    dragOverAt(doc, 10);
    expect(dropLineOf(doc)).toBeTruthy();
    dragOverAt(doc, 120);
    expect(dropLineOf(doc)).toBeNull();
    dragOverAt(doc, 260);
    expect(dropLineOf(doc)).toBeTruthy();
  });

  // An insertion has no row of its own: every position is a change.
  it('still draws the line there for a palette drag', async () => {
    const { doc } = await openModal(['text', 'button', 'divider']);
    layOutRows(doc, 100);
    startPaletteDrag('spacer');

    dragOverAt(doc, 120);

    expect(dropLineOf(doc)).toBeTruthy();
  });
});
