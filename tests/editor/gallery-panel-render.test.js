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
      'Tooltip',
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
    const emptyMessage = empty.$el.querySelector('[data-gallery-empty]');
    expect(emptyMessage).not.toBeNull();
    // announces itself when the grid empties out, like the no-result sibling
    expect(emptyMessage.getAttribute('role')).toBe('status');
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

  // The file objects are Mosaico's. Vue observing them would add a getter
  // and a setter to every property of every image, 31 ms for 5,000 of them.
  it('leaves Mosaico’s file objects alone', () => {
    const files = IMAGES.map((file) => ({ ...file }));
    const panel = mountVm(fakeViewModel(files));
    expect(panel.images).toEqual(files);
    expect(files.every((file) => !('__ob__' in file))).toBe(true);
    panel.$destroy();
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

describe('gallery panel — the tooltip it owns', () => {
  const Tooltip = require('../../packages/editor/src/js/vue/components/gallery/tooltip.js');

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function cell() {
    const el = document.createElement('div');
    document.body.appendChild(el);
    return el;
  }

  // A delay, so sweeping across the grid on the way somewhere else does not
  // flash a tooltip over every cell on the path.
  it('waits before showing anything', () => {
    const panel = mount(IMAGES);
    panel.onHover(IMAGES[0], cell());

    expect(panel.hoveredFile).toBeNull();
    jest.advanceTimersByTime(Tooltip.OPEN_DELAY_MS - 1);
    expect(panel.hoveredFile).toBeNull();
    jest.advanceTimersByTime(1);
    expect(panel.hoveredFile).toBe(IMAGES[0]);

    panel.$destroy();
  });

  it('shows nothing when the pointer leaves before the delay is up', () => {
    const panel = mount(IMAGES);
    panel.onHover(IMAGES[0], cell());
    jest.advanceTimersByTime(Tooltip.OPEN_DELAY_MS - 50);
    panel.onUnhover();
    jest.advanceTimersByTime(500);

    expect(panel.hoveredFile).toBeNull();
    panel.$destroy();
  });

  it('hides immediately on leave, with no delay of its own', () => {
    const panel = mount(IMAGES);
    panel.onHover(IMAGES[0], cell());
    jest.advanceTimersByTime(Tooltip.OPEN_DELAY_MS);
    expect(panel.hoveredFile).toBe(IMAGES[0]);

    panel.onUnhover();
    expect(panel.hoveredFile).toBeNull();
    panel.$destroy();
  });

  // Moving across cells restarts the wait rather than queueing one tooltip per
  // cell the pointer passed over.
  it('describes the last cell hovered, not the first', () => {
    const panel = mount(IMAGES);
    panel.onHover(IMAGES[0], cell());
    jest.advanceTimersByTime(200);
    panel.onHover(IMAGES[1], cell());
    jest.advanceTimersByTime(Tooltip.OPEN_DELAY_MS);

    expect(panel.hoveredFile).toBe(IMAGES[1]);
    panel.$destroy();
  });

  // The scroller can recycle the cell away while the delay runs; describing a
  // detached element would place the tooltip at the origin.
  it('gives up when the cell left the document during the wait', () => {
    const panel = mount(IMAGES);
    const el = cell();
    panel.onHover(IMAGES[0], el);
    el.remove();
    jest.advanceTimersByTime(Tooltip.OPEN_DELAY_MS);

    expect(panel.hoveredFile).toBeNull();
    panel.$destroy();
  });

  it('drops a pending tooltip when the panel is torn down', () => {
    const panel = mount(IMAGES);
    panel.onHover(IMAGES[0], cell());
    panel.$destroy();
    jest.advanceTimersByTime(Tooltip.OPEN_DELAY_MS);

    expect(panel.hoveredFile).toBeNull();
  });
});

// The actions on a thumbnail (rename, re-upload, delete) need
// `gallery.manage` on the server. The panel reads the capability from the
// current user, who is a Knockout observable loaded after the editor opens,
// and re-reads it once the user arrives.
describe('gallery panel — the right to manage', () => {
  function observable(value) {
    const subscribers = [];
    const read = () => read.value;
    read.value = value;
    read.subscribe = (callback) => {
      subscribers.push(callback);
      return { dispose() {} };
    };
    read.set = (next) => {
      read.value = next;
      subscribers.forEach((callback) => callback(next));
    };
    return read;
  }

  function mountWithUser(currentUser) {
    const vm = {
      t: (key) => key,
      addImage() {},
      removeImage() {},
      mailingGallery: observable(IMAGES),
      currentUser,
    };
    const Panel = Vue.extend(createGalleryPanel(vm));
    return new Panel({ propsData: { type: 'mailing' } }).$mount();
  }

  it('grants the actions to a user who holds gallery.manage', () => {
    const panel = mountWithUser(
      observable({ capabilities: ['gallery.manage'] })
    );
    expect(panel.canManage).toBe(true);
    panel.$destroy();
  });

  it('denies them to a user who does not', () => {
    const panel = mountWithUser(observable({ capabilities: [] }));
    expect(panel.canManage).toBe(false);
    panel.$destroy();
  });

  it('denies them while the user is unknown, then re-reads once loaded', () => {
    const user = observable(null);
    const panel = mountWithUser(user);
    expect(panel.canManage).toBe(false);
    user.set({ capabilities: ['gallery.manage'] });
    expect(panel.canManage).toBe(true);
    panel.$destroy();
  });

  it('survives an editor whose view-model carries no user', () => {
    const panel = mountWithUser(undefined);
    expect(panel.canManage).toBe(false);
    panel.$destroy();
  });
});
