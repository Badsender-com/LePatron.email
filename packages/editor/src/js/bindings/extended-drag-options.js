'use strict';

const $ = require('jquery');
const ko = require('knockout');

// What `extsortable` and `extdraggable` add to a jQuery UI sortable/draggable:
// a `dragging` observable that tells the editor a drag is on, and the
// auto-scroll of `dropContainer` while the pointer nears or passes its top or
// bottom edge. jQuery UI's own `scroll` option only scrolls the helper's
// parent, never the email being dropped into.
//
// Kept apart from the bindings so the Vue gallery's drag directive goes
// through the same code: a thumbnail dragged from the gallery has to scroll
// the email exactly like a block dragged from the block list.

const isDraggingHelper = function (writable, e) {
  if (writable()) {
    if (e.type === writable() + 'stop') writable(false);
  } else {
    if (e.type === 'dragstart' || e.type === 'sortstart')
      writable(e.type.substring(0, 4));
  }
};

// Scrolling speed depending on how far the pointer is past the edge.
const scrollStep = function (pageY, $container) {
  const top = pageY - $container.offset().top;
  const bottom = top - $container.height();
  if (top < -20) return -20;
  if (top < 0) return -10;
  if (top < 10) return -5;
  if (bottom > 20) return 20;
  if (bottom > 0) return 10;
  if (bottom > -10) return 5;
  return 0;
};

// Wraps `modelValue.options.start`, `drag` and `stop` in place and returns
// `modelValue`. `modelValue` is the binding value: { options, dragging?,
// dropContainer? }.
const extendDragOptions = function (modelValue) {
  if (!modelValue.options) modelValue.options = {};
  const isDraggingObservable =
    typeof modelValue.dragging !== 'undefined' &&
    ko.isWritableObservable(modelValue.dragging);
  const hasDropContainer = typeof modelValue.dropContainer !== 'undefined';

  const origStart = modelValue.options.start;
  modelValue.options.start = function (e, ui) {
    if (isDraggingObservable) isDraggingHelper(modelValue.dragging, e);
    if (hasDropContainer) {
      modelValue.adding = 0;
      modelValue.scrollInterval = setInterval(function () {
        const $container = $(modelValue.dropContainer);
        $container.scrollTop($container.scrollTop() + modelValue.adding);
      }, 20);
    }
    if (typeof origStart !== 'undefined') return origStart(e, ui);
  };
  const origStop = modelValue.options.stop;
  modelValue.options.stop = function (e, ui) {
    if (isDraggingObservable) isDraggingHelper(modelValue.dragging, e);
    if (hasDropContainer) clearInterval(modelValue.scrollInterval);
    if (typeof origStop !== 'undefined') return origStop(e, ui);
  };
  const origDrag = modelValue.options.drag;
  modelValue.options.drag = function (e, ui) {
    if (hasDropContainer) {
      modelValue.adding = scrollStep(e.pageY, $(modelValue.dropContainer));
    }
    if (typeof origDrag !== 'undefined') return origDrag(e, ui);
  };

  return modelValue;
};

module.exports = { extendDragOptions };
