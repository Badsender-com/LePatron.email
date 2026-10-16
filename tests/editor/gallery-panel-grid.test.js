/**
 * @jest-environment jsdom
 */
'use strict';

// The rendered grid: thumbnails, what clicking and the keyboard do on them,
// the drag directive on each, and the scroll reset. Mounted inside the
// document, where jsdom's zero-size layout still leaves the scroller its
// buffer and it renders its first rows (detached, it renders none, which is
// why gallery-panel-render.test.js only sees the container).
jest.mock('jquery-ui/ui/widgets/draggable', () => ({}), { virtual: true });

const Vue = require('vue/dist/vue.common');
const $ = require('jquery');
const ko = require('knockout');
const {
  createGalleryPanel,
} = require('../../packages/editor/src/js/vue/galleryPlugin.js');

$.fn.draggable = function draggable() {
  return this;
};

const IMAGES = [
  { name: 'a-1.jpg', label: 'un.jpg', thumbnailUrl: '/t/a-1.jpg' },
  { name: 'a-2.png', label: 'deux.png', thumbnailUrl: '/t/a-2.png' },
  { name: 'a-3.gif', thumbnailUrl: '/t/a-3.gif' },
];

let vm;
let panel;

async function mount(images = IMAGES) {
  vm = {
    t: (key, params) => (params ? `${key}:${params.count}` : key),
    addImage: jest.fn(),
    removeImage: jest.fn(),
    mailingGallery: ko.observableArray(images.slice()),
    mailingGalleryStatus: ko.observable(images.length),
  };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const Panel = Vue.extend(createGalleryPanel(vm));
  panel = new Panel({ propsData: { type: 'mailing' } }).$mount(host);
  await Vue.nextTick();
  await Vue.nextTick();
}

// The scroller parks the views it no longer needs off-screen instead of
// removing them; the panel hides their cell.
const thumbs = () =>
  Array.from(panel.$el.querySelectorAll('.gallery-thumb')).filter(
    (el) => !el.closest('.gallery-vue-cell').hidden
  );
const thumbOf = (name) =>
  thumbs().find((el) => ko.utils.domData.get(el, 'ko_dragItem').name === name);

function key(el, name) {
  const event = new KeyboardEvent('keydown', {
    key: name === 'enter' ? 'Enter' : ' ',
    keyCode: name === 'enter' ? 13 : 32,
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(event);
  return event;
}

afterEach(() => {
  panel.$destroy();
  document.body.innerHTML = '';
});

describe('gallery grid — thumbnails', () => {
  it('renders one thumbnail per image', async () => {
    await mount();
    expect(thumbs()).toHaveLength(3);
  });

  it('shows the label, and the file name for an image that has none', async () => {
    await mount();
    expect(thumbOf('a-1.jpg').textContent).toContain('un.jpg');
    expect(thumbOf('a-3.gif').textContent).toContain('a-3.gif');
    expect(thumbOf('a-1.jpg').querySelector('img').getAttribute('alt')).toBe(
      'un.jpg'
    );
  });

  it('marks GIFs, and gives JPGs a solid background instead of the checkerboard', async () => {
    await mount();
    expect(thumbOf('a-3.gif').querySelector('.gallery-thumb__badge')).not.toBe(
      null
    );
    expect(thumbOf('a-1.jpg').querySelector('.gallery-thumb__badge')).toBe(
      null
    );
    const solid = (name) =>
      thumbOf(name)
        .querySelector('.gallery-thumb__img')
        .classList.contains('gallery-thumb__img--solid');
    expect(solid('a-1.jpg')).toBe(true);
    expect(solid('a-2.png')).toBe(false);
  });

  // A label is user input. It is interpolated, never parsed as markup.
  it('renders a label as text', async () => {
    await mount([
      {
        name: 'x.png',
        label: '<img src=x onerror="window.pwned=1">',
        thumbnailUrl: '/t/x.png',
      },
    ]);
    const label = thumbOf('x.png').querySelector('.gallery-thumb__label');
    expect(label.textContent).toBe('<img src=x onerror="window.pwned=1">');
    expect(label.querySelector('img')).toBeNull();
  });

  it('carries the drag payload the email placeholders read', async () => {
    await mount();
    const el = thumbOf('a-2.png');
    expect(el.classList.contains('image')).toBe(true);
    expect(ko.utils.domData.get(el, 'ko_dragItem')).toEqual(IMAGES[1]);
  });
});

describe('gallery grid — picking and deleting', () => {
  it('puts the clicked image in the selected placeholder', async () => {
    await mount();
    thumbOf('a-2.png').click();
    expect(vm.addImage).toHaveBeenCalledWith(IMAGES[1]);
  });

  it('is a button reachable with Tab, named after the image', async () => {
    await mount();
    const el = thumbOf('a-1.jpg');
    expect(el.getAttribute('role')).toBe('button');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('aria-label')).toBe('un.jpg');
  });

  it.each(['enter', 'space'])('picks the image with %s', async (name) => {
    await mount();
    const event = key(thumbOf('a-1.jpg'), name);
    expect(vm.addImage).toHaveBeenCalledWith(IMAGES[0]);
    // Space would otherwise scroll the grid
    expect(event.defaultPrevented).toBe(true);
  });

  it('deletes from the ✕, without also picking the image', async () => {
    await mount();
    thumbOf('a-2.png').querySelector('.gallery-thumb__remove').click();
    expect(vm.removeImage).toHaveBeenCalledWith(IMAGES[1], 'mailing');
    expect(vm.addImage).not.toHaveBeenCalled();
  });

  // Deleting has no confirmation in this PR: it stays a pointer gesture, as
  // in the Knockout grid, rather than one Enter away for the keyboard.
  it('keeps the ✕ out of the tab order and of the accessibility tree', async () => {
    await mount();
    const remove = thumbOf('a-1.jpg').querySelector('.gallery-thumb__remove');
    expect(remove.getAttribute('tabindex')).toBe('-1');
    expect(remove.getAttribute('aria-hidden')).toBe('true');
  });

  it('drops the thumbnail of an image deleted on the Knockout side', async () => {
    await mount();
    vm.mailingGallery.remove((file) => file.name === 'a-2.png');
    await Vue.nextTick();
    await Vue.nextTick();
    expect(thumbs()).toHaveLength(2);
    expect(thumbOf('a-2.png')).toBeUndefined();
  });

  // A parked view is only moved to -9999px: still focusable, still read out,
  // unless its cell is hidden.
  it('takes the parked cell out of the tab order', async () => {
    await mount();
    vm.mailingGallery.remove((file) => file.name === 'a-2.png');
    await Vue.nextTick();
    await Vue.nextTick();
    const cells = panel.$el.querySelectorAll('.gallery-vue-cell');
    expect(cells).toHaveLength(3);
    const parked = Array.from(cells).filter((cell) => cell.hidden);
    expect(parked).toHaveLength(1);
    expect(
      parked[0].closest('.vue-recycle-scroller__item-view').style.transform
    ).toContain('-9999');
  });
});

describe('gallery grid — scroll', () => {
  it.each([
    ['search', 'un'],
    ['format', 'png'],
    ['sortBy', 'date_asc'],
  ])('goes back to the top when the %s changes', async (criterion, value) => {
    await mount();
    const spy = jest.spyOn(panel.$refs.scroller, 'scrollToPosition');
    panel[criterion] = value;
    await Vue.nextTick();
    await Vue.nextTick();
    expect(spy).toHaveBeenCalledWith(0);
  });

  it('stays where it is when an upload lands', async () => {
    await mount();
    const spy = jest.spyOn(panel.$refs.scroller, 'scrollToPosition');
    vm.mailingGallery.unshift({ name: 'a-4.png', thumbnailUrl: '/t/a-4.png' });
    await Vue.nextTick();
    await Vue.nextTick();
    expect(spy).not.toHaveBeenCalled();
  });
});
