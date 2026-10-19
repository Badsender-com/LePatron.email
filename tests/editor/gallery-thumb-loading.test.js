/**
 * @jest-environment jsdom
 */
'use strict';

// A thumbnail whose image has not arrived yet says it is loading, and one
// whose image cannot be read says so, instead of both sitting there empty.
// The virtual scroller hands the same cell to another image: the state
// follows the image, never the cell.
//
// jsdom fetches no image: `complete` and `naturalWidth` are what the browser
// would report, set on the element by hand before its event is fired.

const { FILE, mountThumb } = require('./helpers/thumb.js');

const OTHER = {
  name: '6a2135b7f802c2a6f99a4243-def.png',
  label: 'autre.png',
  thumbnailUrl: '/api/images/cover/111x111/6a2135b7f802c2a6f99a4243-def.png',
};

const media = (vm) => vm.$el.querySelector('[data-gallery-pick]');
const img = (vm) => media(vm).querySelector('img');
const fallback = (vm) => vm.$el.querySelector('[data-gallery-unavailable]');

// what the browser reports of the request in flight
function report(element, { complete, naturalWidth = 0 }) {
  Object.defineProperty(element, 'complete', {
    value: complete,
    configurable: true,
  });
  Object.defineProperty(element, 'naturalWidth', {
    value: naturalWidth,
    configurable: true,
  });
}

function loaded(element) {
  report(element, { complete: true, naturalWidth: 111 });
  element.dispatchEvent(new Event('load'));
}

function broken(element) {
  report(element, { complete: true, naturalWidth: 0 });
  element.dispatchEvent(new Event('error'));
}

function isLoading(vm) {
  return (
    media(vm).getAttribute('aria-busy') === 'true' &&
    media(vm).classList.contains('gallery-thumb__img--loading')
  );
}

describe('thumbnail loading — the image arrives', () => {
  it('says it is loading until the image is there', async () => {
    const vm = mountThumb();
    expect(isLoading(vm)).toBe(true);
    loaded(img(vm));
    await vm.$nextTick();
    expect(isLoading(vm)).toBe(false);
    expect(media(vm).hasAttribute('aria-busy')).toBe(false);
    expect(fallback(vm)).toBeNull();
    vm.$destroy();
  });

  // the control keeps its name while it is busy: a screen reader still
  // reads which image it inserts
  it('keeps the image control named while it loads', () => {
    const vm = mountThumb();
    expect(media(vm).getAttribute('aria-label')).toBe(FILE.label);
    vm.$destroy();
  });

  // An image the browser already holds is complete as soon as its `src` is
  // set: shown as loaded from the first paint, not after a flash of the
  // loading state.
  it('does not flash the loading state for an image already in cache', async () => {
    const complete = Object.getOwnPropertyDescriptor(
      window.HTMLImageElement.prototype,
      'complete'
    );
    const width = Object.getOwnPropertyDescriptor(
      window.HTMLImageElement.prototype,
      'naturalWidth'
    );
    Object.defineProperty(window.HTMLImageElement.prototype, 'complete', {
      get: () => true,
      configurable: true,
    });
    Object.defineProperty(window.HTMLImageElement.prototype, 'naturalWidth', {
      get: () => 111,
      configurable: true,
    });
    try {
      const vm = mountThumb();
      await vm.$nextTick();
      expect(isLoading(vm)).toBe(false);
      vm.$destroy();
    } finally {
      Object.defineProperty(
        window.HTMLImageElement.prototype,
        'complete',
        complete
      );
      Object.defineProperty(
        window.HTMLImageElement.prototype,
        'naturalWidth',
        width
      );
    }
  });
});

describe('thumbnail loading — the image cannot be read', () => {
  it('says the image is unavailable, in words and with an icon', async () => {
    const vm = mountThumb();
    broken(img(vm));
    await vm.$nextTick();
    expect(isLoading(vm)).toBe(false);
    expect(fallback(vm).textContent.trim()).toBe('Image indisponible');
    expect(fallback(vm).querySelector('.lucide-image-off')).not.toBeNull();
    // the browser's broken-image glyph is not drawn over it
    expect(img(vm).style.display).toBe('none');
    vm.$destroy();
  });

  // still the image control: it can be inserted or deleted like any other
  it('keeps the image control and its name', async () => {
    const vm = mountThumb();
    broken(img(vm));
    await vm.$nextTick();
    expect(media(vm).getAttribute('role')).toBe('button');
    expect(media(vm).getAttribute('aria-label')).toBe(FILE.label);
    vm.$destroy();
  });
});

describe('thumbnail loading — the scroller recycles the cell', () => {
  it('starts over when the cell receives another image', async () => {
    const vm = mountThumb();
    loaded(img(vm));
    await vm.$nextTick();
    // the browser starts the new request: nothing complete yet
    vm.file = OTHER;
    report(img(vm), { complete: false });
    await vm.$nextTick();
    expect(img(vm).getAttribute('src')).toBe(OTHER.thumbnailUrl);
    expect(isLoading(vm)).toBe(true);
    loaded(img(vm));
    await vm.$nextTick();
    expect(isLoading(vm)).toBe(false);
    vm.$destroy();
  });

  it('does not carry an error over to the next image', async () => {
    const vm = mountThumb();
    broken(img(vm));
    await vm.$nextTick();
    vm.file = OTHER;
    report(img(vm), { complete: false });
    await vm.$nextTick();
    expect(fallback(vm)).toBeNull();
    expect(img(vm).style.display).toBe('');
    expect(isLoading(vm)).toBe(true);
    vm.$destroy();
  });

  // The previous image's event can still be on its way when the cell is
  // handed over. Taken at its word, it would show the new image as loaded,
  // or as broken, while its own request is still in flight.
  it('ignores an event left over from the previous image', async () => {
    const vm = mountThumb();
    vm.file = OTHER;
    report(img(vm), { complete: false });
    await vm.$nextTick();
    img(vm).dispatchEvent(new Event('load'));
    img(vm).dispatchEvent(new Event('error'));
    await vm.$nextTick();
    expect(isLoading(vm)).toBe(true);
    expect(fallback(vm)).toBeNull();
    vm.$destroy();
  });

  it('shows an image already in cache at once', async () => {
    const vm = mountThumb();
    vm.file = OTHER;
    report(img(vm), { complete: true, naturalWidth: 111 });
    await vm.$nextTick();
    await vm.$nextTick();
    expect(isLoading(vm)).toBe(false);
    vm.$destroy();
  });

  // a rename replaces the entry in place, same image: nothing to reload
  it('keeps the state through a rename of the same image', async () => {
    const vm = mountThumb();
    loaded(img(vm));
    await vm.$nextTick();
    vm.file = { ...FILE, label: 'nouveau.png' };
    await vm.$nextTick();
    expect(isLoading(vm)).toBe(false);
    vm.$destroy();
  });
});
