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
