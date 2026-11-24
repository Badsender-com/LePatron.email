'use strict';

const {
  locateElement,
  rowById,
} = require('../../../../../../shared/block-builder/composition.js');

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
// The selection also decides where the modal works: the ACTIVE COLUMN, the one
// the palette adds to and the element list shows.
//   - an element is selected: its column;
//   - a row is selected: its first column;
//   - nothing is: the first column of the first row.
// It is derived, never stored, so a column that disappears — a structure
// changed, a row removed — cannot leave the modal pointing at it: the next
// read falls back on a column that exists. Finding an element, on the other
// hand, is never limited to that column: an id is looked up across the whole
// composition (locateElement).
//
// A Vue 2 mixin, like the element list and the row settings: the selection is
// read by every surface of the modal, and a mixin keeps `this` meaning the
// component. The component is expected to provide `state`.
//
// It calls no other mixin: everything else reads the selection from here —
// `selectedRow` and `selectedRowIndex` for the rows panel (row-settings.js)
// and the row actions (row-actions.js), `activeColumn` and `columnElements`
// for the element list (element-list.js).

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

    /** The selected row, or null — none when an element is selected. */
    selectedRow() {
      return this.rowById(this.selectedRowId);
    },

    /** Where the selected row sits among the rows, or -1. */
    selectedRowIndex() {
      return (this.state.rows || []).findIndex(
        (row) => row.id === this.selectedRowId
      );
    },

    /** The selected element, wherever it sits, or null. */
    selected() {
      const place = this.locateElement(this.selectedElementId);
      return place ? place.column.elements[place.index] : null;
    },

    /** The column the modal works on — see the rules above — or null. */
    activeColumn() {
      const place = this.locateElement(this.selectedElementId);
      if (place) return place.column;

      const row =
        this.rowById(this.selectedRowId) || (this.state.rows || [])[0];
      return (row && row.columns && row.columns[0]) || null;
    },

    // The active column's own array, so a splice into it changes the
    // composition. Empty, and detached, only when there is no row at all.
    columnElements() {
      return this.activeColumn ? this.activeColumn.elements : [];
    },
  },

  methods: {
    /**
     * Where an element sits in the composition, or null.
     *
     * @param {string} id
     * @returns {{row: Object, column: Object, index: number}|null}
     */
    locateElement(id) {
      return locateElement(this.state, id);
    },

    /** The row with this id, or null. */
    rowById(id) {
      return rowById(this.state, id);
    },

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
