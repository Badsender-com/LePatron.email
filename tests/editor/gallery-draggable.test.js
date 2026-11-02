/**
 * @jest-environment jsdom
 */
'use strict';

// The gallery thumbnail's drag directive. It replaces the Knockout grid's
// `extdraggable` binding, so a drop on an email image placeholder has to keep
// working the same way: the payload under knockout-sortable's DOM-data key,
// `draggingImage` raised for the drop zones, and the email scrolling while the
// pointer is past its edge.
jest.mock('jquery-ui/ui/widgets/draggable', () => ({}), { virtual: true });

const $ = require('jquery');
const ko = require('knockout');
const createGalleryDraggable = require('../../packages/editor/src/js/vue/directives/gallery-draggable.js');

const DRAGKEY = 'ko_dragItem';
const A = { name: 'a.jpg', thumbnailUrl: '/thumb/a.jpg' };
const B = { name: 'b.jpg', thumbnailUrl: '/thumb/b.jpg' };

let draggableCalls;
let container;

beforeEach(() => {
  jest.useFakeTimers();
  draggableCalls = [];
  // the real widget is installed on jQuery by the gulp build, not by Node
  $.fn.draggable = function draggable(arg) {
    draggableCalls.push({ el: this[0], arg });
    if (typeof arg === 'object') $.data(this[0], 'ui-draggable', true);
    return this;
  };
  document.body.innerHTML = '<div id="page"></div>';
  container = document.createElement('div');
  container.id = 'main-wysiwyg-area';
  document.body.appendChild(container);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

function setup() {
  const vm = { draggingImage: ko.observable(false) };
  const directive = createGalleryDraggable(vm);
  const el = document.createElement('div');
  document.getElementById('page').appendChild(el);
  directive.inserted(el, { value: A });
  return { vm, directive, el, options: draggableCalls[0].arg };
}

// jsdom has no layout: offset() and height() are 0, so pageY alone places the
// pointer relative to the email's top (0) and bottom (0) edges.
function dragAt(options, pageY) {
  options.drag({ type: 'drag', pageY }, {});
}

describe('gallery draggable directive', () => {
  it('hands the dropped image to the placeholder through knockout-sortable’s key', () => {
    const { el } = setup();
    expect(ko.utils.domData.get(el, DRAGKEY)).toBe(A);
    // extdroppable only accepts `.image`
    expect(el.classList.contains('image')).toBe(true);
  });

  it('keeps the options the Knockout grid used', () => {
    const { options } = setup();
    expect(options.appendTo).toBe('#page');
    expect(options.connectToSortable).toBe('.ko_container');
    expect(options.cursorAt).toEqual({ top: 24, left: 24 });
  });

  it('builds a small proxy showing the image being dragged', () => {
    const { options } = setup();
    const proxy = options.helper();
    expect(proxy.className).toBe('gallery-drag-helper');
    expect(proxy.style.backgroundImage).toContain('/thumb/a.jpg');
  });

  it('raises draggingImage for the length of the drag, like extdraggable', () => {
    const { vm, options } = setup();
    options.start({ type: 'dragstart' }, {});
    expect(vm.draggingImage()).toBeTruthy();
    options.stop({ type: 'dragstop' }, {});
    expect(vm.draggingImage()).toBe(false);
  });

  describe('scrolling the email', () => {
    let scrolls;

    beforeEach(() => {
      scrolls = [];
      jest.spyOn($.fn, 'scrollTop').mockImplementation(function scrollTop(v) {
        if (v === undefined) return 100;
        scrolls.push({ id: this[0] && this[0].id, value: v });
        return this;
      });
    });

    afterEach(() => $.fn.scrollTop.mockRestore());

    it('scrolls the email down while the pointer is past its bottom edge', () => {
      const { options } = setup();
      options.start({ type: 'dragstart' }, {});
      dragAt(options, 30);
      jest.advanceTimersByTime(20);
      expect(scrolls).toEqual([{ id: 'main-wysiwyg-area', value: 120 }]);
      options.stop({ type: 'dragstop' }, {});
    });

    it('scrolls the email up while the pointer is above its top edge', () => {
      const { options } = setup();
      options.start({ type: 'dragstart' }, {});
      dragAt(options, -30);
      jest.advanceTimersByTime(20);
      expect(scrolls).toEqual([{ id: 'main-wysiwyg-area', value: 80 }]);
      options.stop({ type: 'dragstop' }, {});
    });

    it('stops scrolling once the image is dropped', () => {
      const { options } = setup();
      options.start({ type: 'dragstart' }, {});
      dragAt(options, 30);
      options.stop({ type: 'dragstop' }, {});
      jest.advanceTimersByTime(200);
      expect(scrolls).toEqual([]);
    });
  });

  it('points a recycled cell at the image it now shows', () => {
    const { directive, el } = setup();
    directive.update(el, { value: B, oldValue: A });
    expect(ko.utils.domData.get(el, DRAGKEY)).toBe(B);
  });

  // An upload finishing mid-drag shifts the list and the scroller may recycle
  // the dragged cell onto another image. The placeholder reads the payload on
  // drop, before `stop`: it must still be the image the user picked up.
  it('keeps the dragged image as payload when the cell is recycled mid-drag', () => {
    const { directive, el, options } = setup();
    options.start({ type: 'dragstart' }, {});
    directive.update(el, { value: B, oldValue: A });
    expect(ko.utils.domData.get(el, DRAGKEY)).toBe(A);

    options.stop({ type: 'dragstop' }, {});
    expect(ko.utils.domData.get(el, DRAGKEY)).toBe(B);
  });

  it('keeps its payload after a drag the scroller did not disturb', () => {
    const { el, options } = setup();
    options.start({ type: 'dragstart' }, {});
    options.stop({ type: 'dragstop' }, {});
    expect(ko.utils.domData.get(el, DRAGKEY)).toBe(A);
  });

  it('tears the widget down and drops the payload on unbind', () => {
    const { directive, el } = setup();
    directive.unbind(el);
    expect(draggableCalls.pop()).toEqual({ el, arg: 'destroy' });
    expect(ko.utils.domData.get(el, DRAGKEY)).toBeNull();
  });
});
