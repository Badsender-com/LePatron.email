/**
 * @jest-environment jsdom
 */

'use strict';

// Starting a drag from the palette.
//
// The half of the gesture that happens on the editor page rather than in the
// preview — and the half that failed silently the first time, because the page
// itself cancels native drags. The landing half is in drag-and-drop.test.js.

const {
  openModal,
  transfer,
  startPaletteDrag,
  paletteEntry,
  DRAGGING_CLASS,
} = require('./drag-helpers.js');

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

// The bug this suite did not catch the first time.
//
// Mosaico's `fixPageEvents` (template-loader.js, called from app.js on every
// editor load) puts listeners on `window` that cancel `dragstart` and `drag`
// outright, so that the browser's native drag cannot fight the jQuery UI
// sortable driving the canvas. A native drag therefore cannot start anywhere on
// the editor page unless the event is kept away from `window`.
//
// Nothing here simulated the host page, so D2 passed its tests and did nothing
// in the browser. These do simulate it.
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

  function dispatchOnPalette(paletteType, eventType) {
    const entry = paletteEntry(paletteType);
    expect(entry).toBeTruthy();
    const event = new window.Event(eventType, {
      bubbles: true,
      cancelable: true,
    });
    event.dataTransfer = transfer();
    entry.dispatchEvent(event);
    return event;
  }

  let uninstall;
  beforeEach(() => {
    uninstall = installMosaicoDragGuard();
  });
  afterEach(() => uninstall());

  it.each(['text', 'image', 'spacer'])(
    'starts a %s drag even though window cancels dragstart',
    async (type) => {
      const { modal } = await openModal([]);

      const event = dispatchOnPalette(type, 'dragstart');

      expect(event.defaultPrevented).toBe(false);
      expect(modal.draggingType).toBe(type);
    }
  );

  // `drag` fires for the whole gesture, and cancelling it cancels the drop.
  it('keeps the drag alive, since cancelling `drag` would end it', async () => {
    await openModal([]);
    dispatchOnPalette('button', 'dragstart');

    expect(dispatchOnPalette('button', 'drag').defaultPrevented).toBe(false);
  });
});
