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
//   - the preview does not re-render mid-drag, or the nodes under the cursor
//     are destroyed and the drag ends on nothing;
//   - a dropped element is selected and already says something, so it is
//     visible and editable without a second gesture;
//   - clicking the palette still appends, which is the quick path, the
//     keyboard path, and the fallback.

const {
  openModal,
  transfer,
  rowsOf,
  layOutRows,
  fireIn,
  startPaletteDrag,
  paletteEntry,
  DRAGGING_CLASS,
  DROP_BEFORE_CLASS,
  DROP_AFTER_CLASS,
  SELECTED_CLASS,
  EMPTY_DROP_ID,
} = require('./drag-helpers.js');

const dragOverAt = (doc, clientY) => fireIn(doc, 'dragover', doc.body, clientY);
const dropAt = (doc, clientY) => fireIn(doc, 'drop', doc.body, clientY);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('starting a drag from the palette', () => {
  // `setData` is not optional: without it Firefox never starts the drag at all.
  it('records the type, puts it on the dataTransfer, and marks it a copy', async () => {
    const { modal, doc } = await openModal(['text']);

    const event = startPaletteDrag('image');

    expect(modal.draggingType).toBe('image');
    expect(event.dataTransfer.getData('text/plain')).toBe('image');
    expect(event.dataTransfer.effectAllowed).toBe('copy');
    expect(doc.body.classList.contains(DRAGGING_CLASS)).toBe(true);
  });
});

// The bug this file did not catch the first time.
//
// Mosaico's `fixPageEvents` (template-loader.js, called from app.js on every
// editor load) puts listeners on `window` that cancel `dragstart` and `drag`
// outright, so that the browser's native drag cannot fight the jQuery UI
// sortable driving the canvas. A native drag therefore cannot start anywhere on
// the editor page unless the event is kept away from `window`.
//
// Nothing here simulated the host page, so D2 passed its tests and did nothing
// in the browser. These two do simulate it.
describe('the editor page cancels native drags, and the palette survives it', () => {
  /** What fixPageEvents installs, near enough for this. */
  function installMosaicoDragGuard() {
    const cancel = (event) => event.preventDefault();
    window.addEventListener('dragstart', cancel, false);
    window.addEventListener('drag', cancel, false);
    return () => {
      window.removeEventListener('dragstart', cancel, false);
      window.removeEventListener('drag', cancel, false);
    };
  }

  function dispatchOnPalette(modal, type) {
    const entry = paletteEntry('text');
    expect(entry).toBeTruthy();
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    event.dataTransfer = transfer();
    entry.dispatchEvent(event);
    return event;
  }

  let uninstall;
  beforeEach(() => {
    uninstall = installMosaicoDragGuard();
  });
  afterEach(() => uninstall());

  it('starts the drag even though window cancels dragstart', async () => {
    const { modal } = await openModal([]);

    const event = dispatchOnPalette(modal, 'dragstart');

    expect(event.defaultPrevented).toBe(false);
    expect(modal.draggingType).toBe('text');
  });

  // `drag` fires for the whole gesture, and cancelling it cancels the drop.
  it('keeps the drag alive, since cancelling `drag` would end it', async () => {
    const { modal } = await openModal([]);
    dispatchOnPalette(modal, 'dragstart');

    expect(dispatchOnPalette(modal, 'drag').defaultPrevented).toBe(false);
  });
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
    const { modal, doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);
    startPaletteDrag('image');

    // Above the midpoint of the second row.
    dragOverAt(doc, 120);

    expect(modal.dropIndex).toBe(1);
    expect(rowsOf(doc)[1].classList.contains(DROP_BEFORE_CLASS)).toBe(true);
    expect(rowsOf(doc)[0].classList.contains(DROP_BEFORE_CLASS)).toBe(false);
  });

  it('marks the last row below it when the cursor is past everything', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);
    startPaletteDrag('image');

    dragOverAt(doc, 190);

    expect(modal.dropIndex).toBe(2);
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

    expect(modal.state.elements.map((element) => element.type)).toEqual([
      'divider',
      'text',
      'button',
    ]);
  });

  it('inserts between two elements', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    layOutRows(doc, 100);
    startPaletteDrag('divider');

    dropAt(doc, 120);

    expect(modal.state.elements.map((element) => element.type)).toEqual([
      'text',
      'divider',
      'button',
    ]);
  });

  it('appends when dropped past the last element', async () => {
    const { modal, doc } = await openModal(['text']);
    layOutRows(doc, 100);
    startPaletteDrag('spacer');

    dropAt(doc, 90);

    expect(modal.state.elements.map((element) => element.type)).toEqual([
      'text',
      'spacer',
    ]);
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

describe('a dropped element says something', () => {
  // An element that renders nothing appears nowhere — which is exactly how
  // "I added a text and saw nothing" was reported.
  it.each([
    ['text', 'content', 'block-builder-seed-text'],
    ['button', 'label', 'block-builder-seed-button'],
  ])('seeds a %s', async (type, key, translation) => {
    const { modal } = await openModal([]);

    modal.addElement(type);

    expect(modal.selected[key]).toBe(translation);
  });

  it('renders that seed, so the element is visible at once', async () => {
    const { modal } = await openModal(['text']);

    expect(modal.html).toContain('block-builder-seed-text');
  });

  // Nothing honest to put in an image; the preview's min-height keeps its slot
  // visible and clickable instead.
  it('leaves the image empty', async () => {
    const { modal } = await openModal([]);

    modal.addElement('image');

    expect(modal.selected.src).toBe('');
  });
});

describe('the preview holds still during a drag', () => {
  // Replacing the body mid-drag destroys the nodes the cursor is over: the drop
  // target vanishes and the drag ends on nothing.
  it('holds a render that falls due mid-drag', async () => {
    const { modal, doc } = await openModal(['text']);
    startPaletteDrag('image');
    const before = doc.body.innerHTML;

    modal.scheduleRender();

    expect(modal.renderHeldDuringDrag).toBe(true);
    expect(doc.body.innerHTML).toBe(before);
  });

  it('renders once the drag is over', async () => {
    const { modal, doc } = await openModal(['text']);
    startPaletteDrag('image');
    modal.state.elements[0].content = 'changé après coup';
    modal.scheduleRender();

    modal.handleDragEnd();

    expect(modal.renderHeldDuringDrag).toBe(false);
    expect(doc.body.innerHTML).toContain('changé après coup');
  });
});

describe('an empty block still offers somewhere to drop', () => {
  it('shows a drop target when there is nothing yet', async () => {
    const { doc } = await openModal([]);

    const zone = doc.getElementById(EMPTY_DROP_ID);
    expect(zone).not.toBeNull();
    expect(zone.textContent).toBe('block-builder-drop-here');
  });

  it('takes the target away once something is there', async () => {
    const { modal, doc } = await openModal([]);

    modal.addElement('text');
    modal.renderPreview();

    expect(doc.getElementById(EMPTY_DROP_ID)).toBeNull();
  });

  // The target is preview chrome. It must never reach the generated markup.
  it('keeps it out of what the generator produces', async () => {
    const { modal } = await openModal([]);

    expect(modal.html).toBe('');
    modal.addElement('text');
    expect(modal.html).not.toContain('lp-bb-empty-drop');
  });
});

describe('clicking the palette still works', () => {
  it('appends, and selects what it appended', async () => {
    const { modal } = await openModal(['text']);

    modal.addElement('divider');

    expect(modal.state.elements.map((element) => element.type)).toEqual([
      'text',
      'divider',
    ]);
    expect(modal.selected.type).toBe('divider');
  });

  it('marks the selection in the preview too', async () => {
    const { modal, doc } = await openModal(['text']);

    modal.addElement('divider');
    modal.renderPreview();

    const last = rowsOf(doc)[1];
    expect(last.classList.contains(SELECTED_CLASS)).toBe(true);
  });
});
