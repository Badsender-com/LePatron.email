/**
 * @jest-environment jsdom
 */
'use strict';

// The metadata tooltip the gallery panel owns: one for the whole grid, opened
// after a delay, closed on leave, scroll and delete, following a rename.
jest.mock('jquery-ui/ui/widgets/draggable', () => ({}), { virtual: true });

const Vue = require('vue/dist/vue.common');
const {
  IMAGES,
  fakeViewModel,
  mountVm,
  mount,
} = require('./helpers/gallery-panel.js');

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

  // A rename replaces the entry in the Knockout list; the tooltip open over
  // that image goes on describing it, under its new name.
  it('follows a rename of the image it describes', async () => {
    const vm = fakeViewModel(IMAGES.slice());
    const panel = mountVm(vm);
    panel.onHover(IMAGES[0], cell());
    jest.advanceTimersByTime(Tooltip.OPEN_DELAY_MS);

    vm.mailingGallery.splice(0, 1, { ...IMAGES[0], label: 'renamed.jpg' });
    await Vue.nextTick();

    expect(panel.hoveredFile.label).toBe('renamed.jpg');
    panel.$destroy();
  });

  // The tooltip is placed once, from the cell's box when it opened. Scrolling
  // moves the cells under a still pointer, and a recycled view stays in the
  // document, so nothing else would close a tooltip now describing another
  // image at a position the image left.
  it.each([
    ['an open', Tooltip.OPEN_DELAY_MS],
    ['a pending', 0],
  ])('drops %s tooltip when the grid scrolls', async (_, wait) => {
    const panel = mount(IMAGES);
    await Vue.nextTick();
    panel.onHover(IMAGES[0], cell());
    jest.advanceTimersByTime(wait);

    const scroller = panel.$el.querySelector('.gallery-vue-scroller');
    scroller.dispatchEvent(new Event('scroll'));
    jest.advanceTimersByTime(Tooltip.OPEN_DELAY_MS);

    expect(panel.hoveredFile).toBeNull();
    panel.$destroy();
  });
});
