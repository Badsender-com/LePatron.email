'use strict';

// What is selected: an element, a row, or nothing — one of the three, never
// two at once.
//
// One state, `selection`, written in exactly two places: selectElement and
// selectRow. `selectedElementId` and `selectedRowId` are read off it and
// cannot be written. Two variables set separately is how a row and an element
// ended up selected together, with the panel showing the row's structure and
// the element's settings side by side, and a preset clicked then changing the
// row while the user was looking at the element.
//
// A Vue 2 mixin, like the element list and the row settings: the selection is
// read by every surface of the modal, and a mixin keeps `this` meaning the
// component.

const ELEMENT = 'element';
const ROW = 'row';

const SelectionMixin = {
  data: () => ({
    // `{ kind: 'element' | 'row', id }`, or null when nothing is selected.
    selection: null,
  }),

  computed: {
    selectedElementId() {
      const { selection } = this;
      return selection && selection.kind === ELEMENT ? selection.id : null;
    },

    selectedRowId() {
      const { selection } = this;
      return selection && selection.kind === ROW ? selection.id : null;
    },
  },

  methods: {
    /** Selects an element, or nothing when `id` is empty. */
    selectElement(id) {
      this.selection = id ? { kind: ELEMENT, id } : null;
    },

    /** Selects a row, or nothing when `id` is empty. */
    selectRow(id) {
      this.selection = id ? { kind: ROW, id } : null;
    },

    /**
     * Puts back a selection read earlier off `selection` — what a drag that
     * ends without a drop does — through the two selectors like any other.
     *
     * @param {{kind: string, id: string}|null} saved
     */
    restoreSelection(saved) {
      if (saved && saved.kind === ROW) this.selectRow(saved.id);
      else this.selectElement(saved ? saved.id : null);
    },
  },
};

module.exports = { SelectionMixin };
