/**
 * @jest-environment jsdom
 */

'use strict';

// Starting a drag from the palette.
//
// The half of the gesture that happens on the editor page rather than in the
// preview — and the half that failed silently the first time, because the page
// itself cancels native drags. The landing half is in drag-and-drop.test.js.

const Vue = require('vue/dist/vue.common');

const {
  openModal,
  unmountAll,
  transfer,
  startPaletteDrag,
  paletteEntry,
  DRAGGING_CLASS,
} = require('./drag-helpers.js');

// Duplicated, like the class names in drag-helpers.js: a test that imported it
// could not notice it being changed back to something TinyMCE pastes.
const DRAG_TYPE = 'application/x-lp-block-builder';

afterEach(unmountAll);

describe('starting a drag from the palette', () => {
  // `setData` is not optional: without it Firefox never starts the drag at all.
  it('records the type, puts it on the dataTransfer, and marks it a copy', async () => {
    const { modal, doc } = await openModal(['text']);

    const event = startPaletteDrag('image');

    expect(modal.draggingType).toBe('image');
    expect(event.dataTransfer.getData(DRAG_TYPE)).toBe('image');
    expect(event.dataTransfer.effectAllowed).toBe('copy');
    expect(doc.body.classList.contains(DRAGGING_CLASS)).toBe(true);
  });

  // Released over the settings panel, a `text/plain` drag is pasted into the
  // TinyMCE field by its paste plugin — the word "image", in the user's text.
  it('carries nothing a text field would paste', async () => {
    await openModal(['text']);

    const event = startPaletteDrag('image');

    expect(Object.keys(event.dataTransfer.data)).toEqual([DRAG_TYPE]);
    expect(event.dataTransfer.getData('text/plain')).toBeUndefined();
  });
});

describe('what the page says during a palette drag', () => {
  const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));
  const fadedEntries = () =>
    document.querySelectorAll('.bb-modal__add--dragging');

  /** A dragover on the editor page, outside the preview. */
  function dragOverPage() {
    const event = new window.Event('dragover', {
      bubbles: true,
      cancelable: true,
    });
    event.dataTransfer = transfer();
    document.querySelector('.bb-settings').dispatchEvent(event);
    return event;
  }

  // Mosaico cancels dragover on the whole window, which made every part of
  // the page look like it accepted the drop.
  it('refuses the drop anywhere outside the preview, and says so', async () => {
    await openModal(['text']);
    startPaletteDrag('image');

    const event = dragOverPage();

    expect(event.defaultPrevented).toBe(true);
    expect(event.dataTransfer.dropEffect).toBe('none');
  });

  it('leaves the page alone once the drag is over', async () => {
    const { modal } = await openModal(['text']);
    startPaletteDrag('image');
    modal.handleDragEnd();

    const event = dragOverPage();

    expect(event.defaultPrevented).toBe(false);
    expect(event.dataTransfer.dropEffect).toBeNull();
  });

  // The browser takes its picture of the entry after dragstart returns.
  it('fades the entry only after the drag image has been taken', async () => {
    await openModal([]);
    startPaletteDrag('image');
    await Vue.nextTick();
    expect(fadedEntries()).toHaveLength(0);

    await nextTask();
    await Vue.nextTick();

    expect(fadedEntries()).toHaveLength(1);
    expect(fadedEntries()[0]).toBe(paletteEntry('image'));
  });

  it('never fades it for a drag over before that', async () => {
    const { modal } = await openModal([]);
    startPaletteDrag('image');
    modal.handleDragEnd();

    await nextTask();
    await Vue.nextTick();

    expect(fadedEntries()).toHaveLength(0);
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
