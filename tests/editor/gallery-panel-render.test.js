/**
 * @jest-environment jsdom
 */
'use strict';

// The gallery panel must actually render. Its counter and its chips are
// computed values and keep working even when the grid renders nothing, so a
// suite that only reads computed state reports green on a panel showing no
// images at all — which is exactly what happened when an edit dropped the
// `components` registration: <thumb> and <recycle-scroller> silently became
// unknown elements.
jest.mock('jquery-ui/ui/widgets/draggable', () => ({}), { virtual: true });
require('./helpers/intersection-observer');

const Vue = require('vue/dist/vue.common');
const $ = require('jquery');
const ko = require('knockout');
const en = require('../../public/lang/badsender-en.js');
const {
  createGalleryPanel,
} = require('../../packages/editor/src/js/vue/galleryPlugin.js');

// the real widget is installed on jQuery by the gulp build, not by Node
$.fn.draggable = function draggable() {
  return this;
};

const IMAGES = [
  {
    name: 'a-1.jpg',
    label: 'un.jpg',
    thumbnailUrl: '/api/images/cover/111x111/a-1.jpg',
  },
  {
    name: 'a-2.png',
    label: 'deux.png',
    thumbnailUrl: '/api/images/cover/111x111/a-2.png',
  },
];

// The Mosaico viewModel as the panel sees it, with real Knockout observables
// so the mirror is exercised through its subscription. A loaded gallery
// reports its image count as status.
function fakeViewModel(images, status = images.length) {
  return {
    t: (key, params) => (params ? `${key}:${params.count}` : key),
    addImage() {},
    removeImage() {},
    mailingGallery: ko.observableArray(images),
    mailingGalleryStatus: ko.observable(status),
  };
}

function mountVm(vm) {
  const Panel = Vue.extend(createGalleryPanel(vm));
  return new Panel({ propsData: { type: 'mailing' } }).$mount();
}

function mount(images, status) {
  return mountVm(fakeViewModel(images, status));
}

describe('gallery panel — rendering', () => {
  let warnings;
  let spy;

  beforeEach(() => {
    warnings = [];
    spy = jest.spyOn(console, 'error').mockImplementation((msg) => {
      warnings.push(String(msg));
    });
  });

  afterEach(() => spy.mockRestore());

  it('registers the child components the template uses', () => {
    const { components } = createGalleryPanel({ t: (k) => k });
    expect(Object.keys(components).sort()).toEqual([
      'RecycleScroller',
      'Thumb',
    ]);
  });

  it('mounts without Vue complaining about an unknown element', async () => {
    const panel = mount(IMAGES);
    await Vue.nextTick();
    expect(
      warnings.filter((w) => w.includes('Unknown custom element'))
    ).toEqual([]);
    panel.$destroy();
  });

  it('renders the grid container when the gallery has images', async () => {
    const panel = mount(IMAGES);
    await Vue.nextTick();
    // jsdom gives the scroller no layout, so it renders no rows — the
    // container's presence is what tells us the v-if/v-else chain picked the
    // grid branch rather than an empty state.
    expect(panel.$el.querySelector('.gallery-vue-scroller')).not.toBeNull();
    expect(panel.$el.querySelector('[data-gallery-empty]')).toBeNull();
    expect(panel.$el.querySelector('[data-gallery-no-result]')).toBeNull();
    panel.$destroy();
  });

  it('renders the toolbar only once the gallery holds something', async () => {
    const full = mount(IMAGES);
    await Vue.nextTick();
    expect(full.$el.querySelector('[data-gallery-search]')).not.toBeNull();
    expect(full.$el.querySelectorAll('[data-gallery-format]')).toHaveLength(4);
    expect(full.$el.querySelectorAll('[data-gallery-sort]')).toHaveLength(2);
    full.$destroy();

    const empty = mount([]);
    await Vue.nextTick();
    expect(empty.$el.querySelector('[data-gallery-search]')).toBeNull();
    expect(empty.$el.querySelector('[data-gallery-empty]')).not.toBeNull();
    empty.$destroy();
  });

  it('swaps the grid for the no-result message when a search matches nothing', async () => {
    const panel = mount(IMAGES);
    await Vue.nextTick();
    panel.search = 'zzzz';
    await Vue.nextTick();
    expect(panel.$el.querySelector('[data-gallery-no-result]')).not.toBeNull();
    expect(panel.$el.querySelector('.gallery-vue-scroller')).toBeNull();
    panel.$destroy();
  });
});

// Mosaico's `<type>GalleryStatus` is false before the first load and after a
// failed one, 'loading' while the list is fetched, then the image count. The
// Knockout pane owns the first two states (load button, loading text); the
// panel must stay silent until it is a number, or it says "0 images" and
// "the gallery is empty" under "Loading…".
describe('gallery panel — following the gallery status', () => {
  const count = (panel) => panel.$el.querySelector('.gallery-vue-panel__count');
  const empty = (panel) => panel.$el.querySelector('[data-gallery-empty]');

  it.each([
    ['loading', 'loading'],
    ['not loaded, or failed to', false],
  ])('shows no count and no empty state while %s', async (_, status) => {
    const panel = mount([], status);
    await Vue.nextTick();
    expect(count(panel)).toBeNull();
    expect(empty(panel)).toBeNull();
    expect(panel.$el.querySelector('[data-gallery-search]')).toBeNull();
    panel.$destroy();
  });

  it('says the gallery is empty once it is loaded with nothing in it', async () => {
    const panel = mount([], 0);
    await Vue.nextTick();
    expect(empty(panel).textContent).toBe('gallery-mailing-empty');
    expect(count(panel).textContent).toBe('gallery-image-count:0');
    panel.$destroy();
  });

  it('shows the images once Mosaico has loaded them', async () => {
    const vm = fakeViewModel([], 'loading');
    const panel = mountVm(vm);
    await Vue.nextTick();
    expect(count(panel)).toBeNull();

    // what badsender-gallery.js does when the list arrives
    vm.mailingGalleryStatus(IMAGES.length);
    vm.mailingGallery(IMAGES.slice());
    await Vue.nextTick();
    expect(count(panel).textContent).toBe('gallery-image-count:2');
    expect(panel.$el.querySelector('.gallery-vue-scroller')).not.toBeNull();
    panel.$destroy();
  });

  it('follows an upload and a delete made on the Knockout side', async () => {
    const vm = fakeViewModel(IMAGES.slice());
    const panel = mountVm(vm);
    vm.mailingGallery.unshift({ name: 'a-3.gif', label: 'trois.gif' });
    await Vue.nextTick();
    expect(panel.images.map((f) => f.name)).toEqual([
      'a-3.gif',
      'a-1.jpg',
      'a-2.png',
    ]);
    vm.mailingGallery.splice(1, 1);
    await Vue.nextTick();
    expect(panel.count).toBe(2);
    panel.$destroy();
  });

  // A search or a format survives from one block to the next: an image
  // uploaded under it must not vanish as if the upload had failed.
  describe('an upload under an active filter', () => {
    const names = (panel) => panel.visibleImages.map((file) => file.name);

    // what loadImage does in badsender-gallery.js
    function upload(vm, file) {
      vm.mailingGallery.unshift(file);
      vm.mailingGalleryStatus(vm.mailingGallery().length);
      return Vue.nextTick();
    }

    it('clears a search that would hide the new image', async () => {
      const vm = fakeViewModel(IMAGES.slice());
      const panel = mountVm(vm);
      panel.search = 'un';
      await upload(vm, { name: 'a-3.gif', label: 'bandeau.gif' });
      expect(panel.search).toBe('');
      expect(names(panel)).toContain('a-3.gif');
      panel.$destroy();
    });

    it('clears a format that would hide the new image, and keeps the sort', async () => {
      const vm = fakeViewModel(IMAGES.slice());
      const panel = mountVm(vm);
      panel.format = 'jpg';
      panel.sortBy = 'date_asc';
      await upload(vm, { name: 'a-3.png', label: 'bandeau.png' });
      expect(panel.format).toBe('');
      expect(panel.sortBy).toBe('date_asc');
      expect(names(panel)).toContain('a-3.png');
      panel.$destroy();
    });

    // an image uploaded on the email's placeholder while the gallery is
    // closed lands in the list the reopened pane restores its search over
    it('clears it when the image arrived while the pane was closed', async () => {
      const vm = fakeViewModel(IMAGES.slice());
      // one definition per editor, as the binding builds it: it is what
      // remembers the search from one opening to the next
      const Panel = Vue.extend(createGalleryPanel(vm));
      const open = () => new Panel({ propsData: { type: 'mailing' } }).$mount();
      const closed = open();
      closed.search = 'un';
      closed.$destroy();
      vm.mailingGallery.unshift({ name: 'a-3.gif', label: 'bandeau.gif' });
      vm.mailingGalleryStatus(3);
      const panel = open();
      await Vue.nextTick();
      expect(panel.search).toBe('');
      expect(names(panel)).toContain('a-3.gif');
      panel.$destroy();
    });

    it('keeps a filter the new image matches', async () => {
      const vm = fakeViewModel(IMAGES.slice());
      const panel = mountVm(vm);
      panel.search = 'deux';
      panel.format = 'png';
      await upload(vm, { name: 'a-3.png', label: 'deux bis.png' });
      expect(panel.search).toBe('deux');
      expect(panel.format).toBe('png');
      expect(names(panel)).toEqual(['a-3.png', 'a-2.png']);
      panel.$destroy();
    });

    // A pane reopened with its last search, on a gallery not loaded yet:
    // every image arrives at once, and none of them is an upload.
    it('keeps the filter when the whole gallery loads', async () => {
      const vm = fakeViewModel([], 'loading');
      const panel = mountVm(vm);
      panel.search = 'un';
      vm.mailingGalleryStatus(IMAGES.length);
      vm.mailingGallery(IMAGES.slice());
      await Vue.nextTick();
      expect(panel.search).toBe('un');
      expect(names(panel)).toEqual(['a-1.jpg']);
      panel.$destroy();
    });

    // a rename replaces the entry under the same name: nothing arrived
    it('keeps the filter when an image is replaced under its own name', async () => {
      const vm = fakeViewModel(IMAGES.slice());
      const panel = mountVm(vm);
      panel.search = 'un';
      vm.mailingGallery.splice(1, 1, { ...IMAGES[1], label: 'autre.png' });
      await Vue.nextTick();
      expect(panel.search).toBe('un');
      panel.$destroy();
    });
  });

  it('stops listening to Knockout once destroyed', () => {
    const vm = fakeViewModel(IMAGES.slice());
    const panel = mountVm(vm);
    panel.$destroy();
    expect(vm.mailingGallery.getSubscriptionsCount()).toBe(0);
    expect(vm.mailingGalleryStatus.getSubscriptionsCount()).toBe(0);
  });

  // The real strings and the `__count__` token Mosaico's `t` substitutes.
  it('counts with the real translations', async () => {
    const vm = fakeViewModel(IMAGES.slice(0, 1));
    vm.t = (key, params = {}) =>
      Object.keys(params).reduce(
        (text, name) => text.split(`__${name}__`).join(params[name]),
        en[key]
      );
    const panel = mountVm(vm);
    await Vue.nextTick();
    expect(count(panel).textContent).toBe('1 image');
    vm.mailingGallery.push(IMAGES[1]);
    vm.mailingGalleryStatus(2);
    await Vue.nextTick();
    expect(count(panel).textContent).toBe('2 images');
    panel.$destroy();
  });
});
