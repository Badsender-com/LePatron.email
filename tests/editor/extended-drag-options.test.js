/**
 * @jest-environment jsdom
 */
'use strict';

// The wrapper behind `extsortable`, `extdraggable` and the gallery's drag
// directive. The directive's own suite covers the drag side; this one covers
// what only the block list uses: a sortable, and options the caller already
// hooked.
const ko = require('knockout');
const {
  extendDragOptions,
} = require('../../packages/editor/src/js/bindings/extended-drag-options.js');

describe('extendDragOptions', () => {
  it('flags a sort as "sort" and only clears it on the matching stop', () => {
    const dragging = ko.observable(false);
    const { options } = extendDragOptions({ dragging, options: {} });

    options.start({ type: 'sortstart' });
    expect(dragging()).toBe('sort');
    options.stop({ type: 'dragstop' });
    expect(dragging()).toBe('sort');
    options.stop({ type: 'sortstop' });
    expect(dragging()).toBe(false);
  });

  it('still calls the start, drag and stop the caller passed', () => {
    const calls = [];
    const { options } = extendDragOptions({
      options: {
        start: () => calls.push('start'),
        drag: () => calls.push('drag'),
        stop: () => calls.push('stop'),
      },
    });
    options.start({ type: 'dragstart' });
    options.drag({ type: 'drag', pageY: 0 });
    options.stop({ type: 'dragstop' });
    expect(calls).toEqual(['start', 'drag', 'stop']);
  });

  it('accepts a binding value with no options', () => {
    const { options } = extendDragOptions({});
    expect(typeof options.start).toBe('function');
  });
});
