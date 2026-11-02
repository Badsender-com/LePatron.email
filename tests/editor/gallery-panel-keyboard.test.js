/**
 * @jest-environment jsdom
 */
'use strict';

// The keyboard in the virtualised grid. The scroller recycles its views, so
// DOM order is pool order, not list order: Tab used to walk the thumbnails
// out of order. The grid is now a single tab stop (roving tabindex), and the
// arrows, Home and End move through the list in its own order.
jest.mock('jquery-ui/ui/widgets/draggable', () => ({}), { virtual: true });

const Vue = require('vue/dist/vue.common');
const { mountGrid, unmountGrid } = require('./helpers/gallery-grid.js');

const COLUMNS = 3;
const ROW_HEIGHT = 118;

// cat 0, dog 1, cat 2…: a search for "dog" keeps every other image
function images(count) {
  return Array.from({ length: count }, (_, i) => ({
    name: `f-${i}.png`,
    label: `${i % 2 ? 'dog' : 'cat'} ${i}`,
    thumbnailUrl: `/t/${i}.png`,
  }));
}

let panel;

// Mounted in the document, jsdom's zero-size layout leaves the scroller its
// buffer only: it renders the first six images, two rows.
async function mount(count = 6) {
  ({ panel } = await mountGrid(images(count)));
}

afterEach(() => unmountGrid(panel));

const cellAt = (index) =>
  panel.$el.querySelector(
    `.gallery-vue-cell[data-gallery-index="${index}"]:not([hidden])`
  );
const pickAt = (index) => cellAt(index).querySelector('[data-gallery-pick]');
const tabStops = () =>
  Array.from(
    panel.$el.querySelectorAll(
      '.gallery-vue-cell:not([hidden]) [data-gallery-pick]'
    )
  ).filter((pick) => pick.getAttribute('tabindex') === '0');

async function settle() {
  await Vue.nextTick();
  await Vue.nextTick();
}

async function press(key) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  document.activeElement.dispatchEvent(event);
  await settle();
  return event;
}

// jsdom fires no scroll event when scrollTop is set, and the scroller
// renders the new rows on the next animation frame after one.
async function scrolled() {
  panel.$refs.scroller.$el.dispatchEvent(new Event('scroll'));
  await new Promise((resolve) => setTimeout(resolve, 50));
  await settle();
}

// A wheel scrolls a row or so at a time, which the scroller follows by
// recycling the views that leave its range.
async function wheel(rows) {
  const { $el } = panel.$refs.scroller;
  for (let row = 0; row < rows; row += 1) {
    $el.scrollTop += ROW_HEIGHT;
    await scrolled();
  }
}

describe('gallery grid keyboard — one tab stop', () => {
  it('makes the first image the only thumbnail reachable with Tab', async () => {
    await mount();
    expect(tabStops()).toEqual([pickAt(0)]);
  });

  // Tab goes from the image to its own action bar, then out of the grid:
  // the bars of the other thumbnails are not on the way.
  it('keeps the action bar of that image, and only that one, in the tab order', async () => {
    await mount();
    cellAt(0)
      .querySelectorAll('button')
      .forEach((button) => expect(button.getAttribute('tabindex')).toBeNull());
    [1, 2, 3, 4].forEach((index) => {
      const buttons = cellAt(index).querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach((button) =>
        expect(button.getAttribute('tabindex')).toBe('-1')
      );
    });
  });

  it('moves the tab stop to an image focused another way', async () => {
    await mount();
    pickAt(3).focus();
    await settle();
    expect(tabStops()).toEqual([pickAt(3)]);
    expect(cellAt(3).querySelector('button').getAttribute('tabindex')).toBe(
      null
    );
  });
});

describe('gallery grid keyboard — the keys', () => {
  it.each([
    ['ArrowRight', 4, 5],
    ['ArrowLeft', 4, 3],
    ['ArrowDown', 1, 1 + COLUMNS],
    ['ArrowUp', 4, 4 - COLUMNS],
    ['Home', 4, 0],
    ['End', 1, 5],
  ])('%s from image %i goes to image %i', async (key, from, to) => {
    await mount();
    pickAt(from).focus();
    await settle();
    const event = await press(key);
    expect(document.activeElement).toBe(pickAt(to));
    expect(tabStops()).toEqual([pickAt(to)]);
    // the arrows and Home/End would otherwise scroll the grid as well
    expect(event.defaultPrevented).toBe(true);
  });

  it.each([
    ['ArrowLeft', 0],
    ['ArrowUp', 1],
    ['ArrowRight', 4],
    ['ArrowDown', 3],
  ])('%s stays on image %i at the edge of the grid', async (key, from) => {
    await mount(5);
    pickAt(from).focus();
    await settle();
    const event = await press(key);
    expect(document.activeElement).toBe(pickAt(from));
    expect(event.defaultPrevented).toBe(true);
  });

  // a row cut short below: down lands on the last image rather than nowhere
  it('goes down to the last image when the row below is shorter', async () => {
    await mount(5);
    pickAt(2).focus();
    await settle();
    await press('ArrowDown');
    expect(document.activeElement).toBe(pickAt(4));
  });

  it('leaves the arrows to a field typed in', async () => {
    await mount();
    cellAt(0).querySelector('[data-gallery-rename]').click();
    await settle();
    const input = cellAt(0).querySelector('[data-gallery-label-input]');
    expect(document.activeElement).toBe(input);
    const event = await press('ArrowRight');
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it('leaves the other keys alone', async () => {
    await mount();
    pickAt(0).focus();
    const event = await press('a');
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(pickAt(0));
  });
});

describe('gallery grid keyboard — an image out of the view', () => {
  // only the first rows are rendered: the last image is not in the DOM
  it('scrolls the image reached into view, then focuses it', async () => {
    await mount(300);
    const spy = jest.spyOn(panel.$refs.scroller, 'scrollToItem');
    pickAt(0).focus();
    await press('End');
    expect(spy).toHaveBeenCalledWith(299);
    await scrolled();
    expect(document.activeElement).toBe(pickAt(299));
    expect(tabStops()).toEqual([pickAt(299)]);
  });

  // Scrolled away from with the wheel, the image is no longer rendered: Tab
  // reaches the grid itself, which brings the image back and hands it the
  // focus, rather than starting over from the first one.
  it('keeps the position when the image leaves the view', async () => {
    await mount(300);
    pickAt(4).focus();
    await settle();
    const scroller = panel.$refs.scroller;
    await wheel(10);
    expect(cellAt(4)).toBeNull();
    expect(tabStops()).toEqual([]);
    expect(scroller.$el.getAttribute('tabindex')).toBe('0');
    const spy = jest.spyOn(scroller, 'scrollToItem');
    scroller.$el.focus();
    expect(spy).toHaveBeenCalledWith(4);
    await scrolled();
    expect(document.activeElement).toBe(pickAt(4));
    expect(scroller.$el.getAttribute('tabindex')).toBeNull();
  });

  // The scroller reports its range at every row scrolled; re-rendering the
  // panel for it would re-render every cell, drag directive included.
  it('does not re-render the grid while the image stays in range', async () => {
    await mount(300);
    const updated = jest.fn();
    panel.$on('hook:updated', updated);
    await wheel(1);
    expect(updated).not.toHaveBeenCalled();
  });

  // A click on a label or between the cells focuses the grid too, being the
  // nearest element that takes the focus: no keyboard user arriving, and
  // bringing the image back would scroll the grid under the pointer.
  it('stays where the pointer is when a click focuses the grid', async () => {
    await mount(300);
    pickAt(4).focus();
    await settle();
    await wheel(10);
    const scroller = panel.$refs.scroller;
    const spy = jest.spyOn(scroller, 'scrollToItem');
    scroller.$el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    scroller.$el.focus();
    scroller.$el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(spy).not.toHaveBeenCalled();
  });

  // Dragging the scrollbar far away renders the new rows at once, and the
  // scroller leaves the old views where they were until the next scroll.
  // The current image's old view is not a second tab stop.
  it('keeps a single tab stop after a jump of the scrollbar', async () => {
    await mount(300);
    pickAt(4).focus();
    await settle();
    const scroller = panel.$refs.scroller;
    scroller.$el.scrollTop = 100 * ROW_HEIGHT;
    await scrolled();
    expect(tabStops()).toEqual([]);
    expect(scroller.$el.getAttribute('tabindex')).toBe('0');
  });

  it('keeps the image when the list is filtered', async () => {
    await mount();
    pickAt(5).focus();
    await settle();
    panel.search = 'dog';
    await settle();
    // dog 1, dog 3, dog 5: the sixth image is now the third
    expect(tabStops()).toEqual([pickAt(2)]);
    expect(pickAt(2).getAttribute('aria-label')).toBe('dog 5');
  });

  // the image it was on is hidden: the one now in its place
  it('keeps the place of an image the filter hides', async () => {
    await mount();
    pickAt(1).focus();
    await settle();
    panel.search = 'cat';
    await settle();
    expect(tabStops()).toEqual([pickAt(1)]);
    expect(pickAt(1).getAttribute('aria-label')).toBe('cat 2');
  });

  it('goes back to the image when the filter is cleared', async () => {
    await mount();
    pickAt(5).focus();
    await settle();
    panel.search = 'cat';
    await settle();
    panel.search = '';
    await settle();
    expect(tabStops()).toEqual([pickAt(5)]);
  });
});

describe('gallery grid keyboard — what a screen reader is told', () => {
  // a list rather than a grid: the scroller lays its cells out with no row
  // element, which a grid requires
  it('is a named list, each cell giving its place in the whole list', async () => {
    await mount();
    const list = panel.$refs.scroller.$el;
    expect(list.getAttribute('role')).toBe('list');
    expect(list.getAttribute('aria-label')).toBe('gallery-list-label');
    const cell = cellAt(5);
    expect(cell.getAttribute('role')).toBe('listitem');
    expect(cell.getAttribute('aria-posinset')).toBe('6');
    expect(cell.getAttribute('aria-setsize')).toBe('6');
  });
});
