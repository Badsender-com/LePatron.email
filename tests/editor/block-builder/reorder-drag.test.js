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
  unmountAll,
  rowsOf,
  layOutRows,
  fireIn,
  dragOverAt,
  dropAt,
  startPaletteDrag,
  dragOverPage,
  nextTask,
  typesOf,
  dropLineOf,
  ELEMENT_ATTRIBUTE,
  DRAGGING_CLASS,
  MOVING_CLASS,
} = require('./drag-helpers.js');

// Duplicated, like the class names in drag-helpers.js: a test that imported it
// could not notice it being changed back to something TinyMCE pastes.
const DRAG_TYPE = 'application/x-lp-block-builder';

afterEach(unmountAll);

describe('a rendered row can be picked up', () => {
  it('is marked draggable, without that reaching the generated markup', async () => {
    const { modal, doc } = await openModal(['text', 'button']);

    rowsOf(doc).forEach((row) => expect(row.draggable).toBe(true));
    // `draggable` is preview chrome. An email has no use for it.
    expect(modal.html).not.toContain('draggable');
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
    dropAt(doc, 10);

    expect(typesOf(modal)).toEqual(['divider', 'text', 'button']);
  });

  it('moves it down', async () => {
    const { modal, doc } = await openModal(['text', 'button', 'divider']);
    layOutRows(doc, 100);

    fireIn(doc, 'dragstart', rowsOf(doc)[0]);
    dropAt(doc, 290);

    expect(typesOf(modal)).toEqual(['button', 'divider', 'text']);
  });

  // The off-by-one. Dropping an element just past itself must not skip a row.
  it('lands exactly one place down, not two', async () => {
    const { modal, doc } = await openModal(['text', 'button', 'divider']);
    layOutRows(doc, 100);

    // Past the midpoint of the second row: index 2 in current layout.
    fireIn(doc, 'dragstart', rowsOf(doc)[0]);
    dropAt(doc, 160);

    expect(typesOf(modal)).toEqual(['button', 'text', 'divider']);
  });

  it('leaves the order alone when dropped where it already is', async () => {
    const { modal, doc } = await openModal(['text', 'button', 'divider']);
    layOutRows(doc, 100);

    fireIn(doc, 'dragstart', rowsOf(doc)[1]);
    dropAt(doc, 120);

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

  it('keeps the moved element selected', async () => {
    const { modal, doc } = await openModal(['text', 'button', 'divider']);
    layOutRows(doc, 100);
    const [, second] = modal.state.elements;

    fireIn(doc, 'dragstart', rowsOf(doc)[1]);
    dropAt(doc, 10);
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
    dragOverAt(doc, 190);
    dropAt(doc, 190);

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
    dropAt(doc, 10);

    expect(typesOf(modal)).toEqual(['button', 'text']);
  });

  it('moves when the drag came from a row', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);

    fireIn(doc, 'dragstart', rowsOf(doc)[1]);
    dropAt(doc, 10);

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
    dragOverAt(doc, 10);
    dropAt(doc, 10);
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

describe('the arrows still work', () => {
  it('moves the selected element up', async () => {
    const { modal } = await openModal(['text', 'button']);

    modal.move(-1);

    expect(typesOf(modal)).toEqual(['button', 'text']);
  });
});
