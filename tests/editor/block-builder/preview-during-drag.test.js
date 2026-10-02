/**
 * @jest-environment jsdom
 */

'use strict';

// What the preview does around a drag: it holds still while one is under way,
// it offers somewhere to drop when the block is empty, and none of the chrome
// it draws for the drag ever reaches the block that gets applied.

const Vue = require('vue/dist/vue.common');

const {
  openModal,
  layOutRows,
  rowsOf,
  startPaletteDrag,
  dragOverAt,
  dropAt,
  dropLineOf,
  ELEMENT_ATTRIBUTE,
  DRAGGING_CLASS,
  SELECTED_CLASS,
  EMPTY_DROP_ID,
} = require('./drag-helpers.js');

afterEach(() => {
  document.body.innerHTML = '';
  jest.restoreAllMocks();
});

describe('the preview holds still during a drag', () => {
  /** Keeps every requested frame, to be run when the test says so. */
  function captureFrames() {
    const frames = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((run) => {
      frames.push(run);
      return frames.length;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    return frames;
  }

  /** Opens on one text, with the frames its composing asked for already run. */
  async function openSettled(frames) {
    const opened = await openModal(['text']);
    layOutRows(opened.doc, 100);
    await Vue.nextTick();
    frames.splice(0).forEach((run) => run());
    return opened;
  }

  // Replacing the body mid-drag destroys the nodes the cursor is over: the drop
  // target vanishes and the drag ends on nothing.
  it('holds a render that falls due mid-drag, without asking for a frame', async () => {
    const frames = captureFrames();
    const { modal } = await openSettled(frames);
    startPaletteDrag('image');

    modal.scheduleRender();

    expect(modal.renderHeld).toBe(true);
    expect(frames).toHaveLength(0);
  });

  // The frame was asked for before the drag; it runs during it.
  it('holds a render whose frame was requested before the drag began', async () => {
    const frames = captureFrames();
    const { modal, doc } = await openSettled(frames);
    modal.state.elements[0].content = 'changé avant le drag';
    await Vue.nextTick();
    expect(frames).toHaveLength(1);

    startPaletteDrag('image');
    frames[0]();

    expect(doc.body.innerHTML).not.toContain('changé avant le drag');
    expect(modal.renderHeld).toBe(true);
  });

  it('renders what was held once the drag is over', async () => {
    const frames = captureFrames();
    const { modal, doc } = await openSettled(frames);
    startPaletteDrag('image');
    modal.state.elements[0].content = 'changé après coup';
    await Vue.nextTick();

    modal.handleDragEnd();
    expect(frames).toHaveLength(1);
    frames[0]();

    expect(modal.renderHeld).toBe(false);
    expect(doc.body.innerHTML).toContain('changé après coup');
  });

  // The drop thaws a held render and inserts in the same task: one render
  // covers both, not one each.
  it('renders once after a drop that released a held render', async () => {
    const frames = captureFrames();
    const { modal, doc } = await openSettled(frames);
    const render = jest.spyOn(modal, 'renderPreview');
    startPaletteDrag('divider');
    modal.state.elements[0].content = 'changé pendant le drag';
    await Vue.nextTick();

    dropAt(doc, 90);
    await Vue.nextTick();
    frames.splice(0).forEach((run) => run());

    expect(render).toHaveBeenCalledTimes(1);
    expect(rowsOf(doc)).toHaveLength(2);
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
});

// The drag draws on the preview — a class on the body, an outline on every row,
// an insertion line — and the preview is a live document the user is looking
// at. Apply must write what the generator makes of the state, and never pick
// any of that up on the way.
describe('none of the drag chrome reaches the block', () => {
  it('applies clean markup after a full drag, dragover and drop', async () => {
    const { modal, doc, markup } = await openModal(['text']);
    layOutRows(doc, 100);
    startPaletteDrag('button');
    dragOverAt(doc, 90);
    // The chrome is really there mid-drag, or this test proves nothing.
    expect(doc.body.classList.contains(DRAGGING_CLASS)).toBe(true);
    expect(dropLineOf(doc)).not.toBeNull();

    dropAt(doc, 90);
    modal.handleApply();

    const written = markup();
    expect(written).toContain('<table role="presentation"');
    expect(written).not.toMatch(/lp-bb-/);
    expect(written).not.toContain('position:absolute');
    expect(written).not.toContain(ELEMENT_ATTRIBUTE);
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
