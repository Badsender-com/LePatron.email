'use strict';

const $ = require('jquery');
const ko = require('knockout');
require('jquery-ui/ui/widgets/draggable');
const {
  extendDragOptions,
} = require('../../bindings/extended-drag-options.js');

// Knockout-sortable stores the dragged payload under this DOM-data key; the
// email image placeholders (extdroppable, accept: '.image') read it back via
// ko.utils.domData.get(el, DRAGKEY). See node_modules/knockout-sortable.
const DRAGKEY = 'ko_dragItem';

// The email's scrolling area, the one a drop target may lie outside of.
const DROP_CONTAINER = '#main-wysiwyg-area';

// Cells being dragged, each with the image the scroller has since moved into
// it, if any. An upload that lands mid-drag shifts the list, and the scroller
// may then recycle the dragged cell onto another image; the placeholder reads
// the payload on drop, which comes before `stop`, so the payload must not
// follow the cell until the drag is over.
const pendingWhileDragging = new WeakMap();

// Vue directive factory that reproduces the knockout-sortable `draggable`
// contract on a Vue-rendered thumbnail, so gallery images can still be dropped
// onto email image placeholders without any Knockout binding on the element.
// Recycle-safe: init once on insert, refresh the payload on update (vue-virtual-
// scroller reuses DOM nodes), destroy on unbind.
module.exports = function createGalleryDraggable(vm) {
  return {
    inserted(el, binding) {
      const file = binding.value;
      // Required by the drop target's `accept: '.image'`
      el.classList.add('image');
      ko.utils.domData.set(el, DRAGKEY, file);
      // The same binding value the Knockout grid gave `extdraggable`, run
      // through the same wrapper: it raises `draggingImage` (drop-zone
      // highlighting, and the fudroppable on #main-wysiwyg-area, see
      // main.tmpl.html) and scrolls the email while the pointer is past its
      // top or bottom edge.
      const { options } = extendDragOptions({
        dropContainer: DROP_CONTAINER,
        dragging: vm.draggingImage,
        options: {
          // Small drag proxy centered on the cursor (cursorAt) instead of a
          // full-size clone: keeps the drop hit-point aligned with the
          // pointer, which matters for small upload zones. Reads the current
          // file from DOM data so it stays correct across virtual-scroller
          // node recycling.
          helper() {
            const dragged = ko.utils.domData.get(el, DRAGKEY);
            const proxy = document.createElement('div');
            proxy.className = 'gallery-drag-helper';
            if (dragged && dragged.thumbnailUrl) {
              proxy.style.backgroundImage =
                'url("' + dragged.thumbnailUrl + '")';
            }
            return proxy;
          },
          cursorAt: { top: 24, left: 24 },
          appendTo: '#page',
          connectToSortable: '.ko_container',
          start() {
            pendingWhileDragging.set(el, null);
          },
          stop() {
            const pending = pendingWhileDragging.get(el);
            pendingWhileDragging.delete(el);
            if (pending) ko.utils.domData.set(el, DRAGKEY, pending);
          },
        },
      });
      $(el).draggable(options);
    },
    // Recycled node: point the payload to the now-current file, once any
    // drag of the previous one is over
    update(el, binding) {
      if (binding.value === binding.oldValue) return;
      if (pendingWhileDragging.has(el)) {
        pendingWhileDragging.set(el, binding.value);
        return;
      }
      ko.utils.domData.set(el, DRAGKEY, binding.value);
    },
    unbind(el) {
      if ($(el).data('ui-draggable')) {
        $(el).draggable('destroy');
      }
      ko.utils.domData.set(el, DRAGKEY, null);
      pendingWhileDragging.delete(el);
    },
  };
};
