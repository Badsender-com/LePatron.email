/**
 * @jest-environment jsdom
 */

'use strict';

// What the preview does around a drag: it holds still while one is under way,
// it offers somewhere to drop when the block is empty, and none of the chrome
// it draws for the drag ever reaches the block that gets applied.

const {
  openModal,
  layOutRows,
  rowsOf,
  startPaletteDrag,
  dragOverAt,
  dropAt,
  ELEMENT_ATTRIBUTE,
  DRAGGING_CLASS,
  DROP_AFTER_CLASS,
  SELECTED_CLASS,
  EMPTY_DROP_ID,
} = require('./drag-helpers.js');

afterEach(() => {
  document.body.innerHTML = '';
  jest.restoreAllMocks();
});

describe('the preview holds still during a drag', () => {
  // Replacing the body mid-drag destroys the nodes the cursor is over: the drop
  // target vanishes and the drag ends on nothing.
  it('holds a render that falls due mid-drag, without asking for a frame', async () => {
    const { modal } = await openModal(['text']);
    const frame = jest.spyOn(window, 'requestAnimationFrame');
    startPaletteDrag('image');

    modal.scheduleRender();

    expect(modal.renderHeldDuringDrag).toBe(true);
    expect(frame).not.toHaveBeenCalled();
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
    expect(doc.body.querySelector(`.${DROP_AFTER_CLASS}`)).not.toBeNull();

    dropAt(doc, 90);
    modal.handleApply();

    const written = markup();
    expect(written).toContain('<table role="presentation"');
    expect(written).not.toMatch(/lp-bb-/);
    expect(written).not.toContain(ELEMENT_ATTRIBUTE);
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

  it('leaves the image empty', async () => {
    const { modal } = await openModal([]);

    modal.addElement('image');

    expect(modal.selected.src).toBe('');
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
