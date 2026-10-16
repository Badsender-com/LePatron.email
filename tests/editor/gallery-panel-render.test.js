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

function mount(images) {
  const observable = Object.assign(() => images, {
    subscribe: () => ({ dispose() {} }),
  });
  const vm = {
    t: (key, params) => (params ? `${key}:${params.count}` : key),
    addImage() {},
    removeImage() {},
    mailingGallery: observable,
  };
  const Panel = Vue.extend(createGalleryPanel(vm));
  return new Panel({ propsData: { type: 'mailing' } }).$mount();
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
