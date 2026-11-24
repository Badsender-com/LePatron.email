'use strict';

// The keyboard of a list you pick from: the rows, and the elements.
//
// Both are a listbox with a roving tabindex — one Tab stop, the selected option
// or the first, and the arrows to move within it. Selection follows the focus:
// an arrow selects the option it lands on, as a click would. Enter and Space
// select the focused option.
//
// Written once because the two lists sit one above the other in the same
// panel: a keyboard user who learnt one has learnt the other, and two copies of
// the motif would drift apart the first time one of them was fixed.
//
// A Vue 2 mixin rather than a plain function: moving the focus needs the
// component's `$el` and `$nextTick`.

const ListboxMixin = {
  methods: {
    /**
     * The tabindex of an option: 0 for the one Tab stops on, -1 otherwise.
     *
     * @param {number} index the option's position
     * @param {number} selectedIndex the selected option's, or -1
     * @returns {number}
     */
    listboxTabIndex(index, selectedIndex) {
      return index === (selectedIndex === -1 ? 0 : selectedIndex) ? 0 : -1;
    },

    /**
     * Handles a key pressed on an option.
     *
     * @param {KeyboardEvent} event
     * @param {number} index the option the key was pressed on
     * @param {Object} list
     * @param {number} list.length how many options there are
     * @param {function(number)} list.select selects the option at an index
     * @param {string} list.options the selector of the options, scoped to
     *   their list: the panel holds two listboxes, and an unscoped query walks
     *   into the other one — which is exactly what happened the first time a
     *   second listbox appeared in it
     */
    onListboxKeydown(event, index, { length, select, options }) {
      const { key } = event;
      if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        select(index);
        return;
      }
      if (key !== 'ArrowDown' && key !== 'ArrowUp') return;

      event.preventDefault();
      const next = index + (key === 'ArrowDown' ? 1 : -1);
      if (next < 0 || next >= length) return;
      select(next);
      // After the render, which moves the tabindex onto the new option.
      this.$nextTick(() => {
        const found = this.$el.querySelectorAll(options);
        if (found[next]) found[next].focus();
      });
    },
  },
};

module.exports = { ListboxMixin };
