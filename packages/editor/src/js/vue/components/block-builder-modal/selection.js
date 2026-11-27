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
//   - a row is selected: the column chosen with it (selectColumn), its first
//     one unless one was chosen;
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
// and the row actions (row-actions.js), `activeColumn`, `activeColumnPlace`
// and `columnElements` for the element list (element-list.js).

const ELEMENT = 'element';
const ROW = 'row';

const SelectionMixin = {
  data: () => ({
    // `{ kind: 'element', id }`, `{ kind: 'row', id, column }` — `column`
    // the index of the column chosen in it — or null when nothing is
    // selected.
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

      const row = this.rowById(this.selectedRowId);
      if (row && row.columns) {
        // A column chosen and since gone falls back on the first one.
        return row.columns[this.selection.column] || row.columns[0] || null;
      }
      const [first] = this.state.rows || [];
      return (first && first.columns && first.columns[0]) || null;
    },

    /**
     * The chosen column, as `{ rowId, index }`, while a row is selected;
     * null otherwise — an element's own column is not chosen, it follows.
     */
    chosenColumn() {
      const row = this.rowById(this.selectedRowId);
      if (!row || !row.columns) return null;
      const index = row.columns.indexOf(this.activeColumn);
      return index === -1 ? null : { rowId: row.id, index };
    },

    /**
     * Where the active column sits, counted from 1 as a user reads it:
     * `{ row, column }`, or null when there is no column at all.
     */
    activeColumnPlace() {
      const column = this.activeColumn;
      if (!column) return null;
      const rows = this.state.rows || [];
      const row = rows.findIndex((each) => each.columns.includes(column));
      if (row === -1) return null;
      return { row: row + 1, column: rows[row].columns.indexOf(column) + 1 };
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

    // The row the selected element sits in, marked in the list while the
    // element — not the row — is selected: the list keeps showing where the
    // user is working.
    isCurrentRow(row) {
      if (!this.selectedElementId) return false;
      const place = this.locateElement(this.selectedElementId);
      return Boolean(place) && place.row === row;
    },

    /** Selects a row, with its first column, or nothing when `id` is empty. */
    selectRow(id) {
      this.selectColumn(id, 0);
    },

    /**
     * Selects a row with one of its columns: the one the palette adds to and
     * the element list shows. Nothing when `rowId` is empty.
     *
     * @param {string} rowId
     * @param {number} index the column, from 0
     */
    selectColumn(rowId, index) {
      this.selection = rowId
        ? { kind: ROW, id: rowId, column: Number.isInteger(index) ? index : 0 }
        : null;
    },

    /**
     * Puts back a selection read earlier off `selection` — what a drag that
     * ends without a drop does — through the two selectors like any other.
     *
     * @param {{kind: string, id: string}|null} saved
     */
    restoreSelection(saved) {
      if (saved && saved.kind === ROW) this.selectColumn(saved.id, saved.column);
      else this.selectElement(saved ? saved.id : null);
    },
  },
};

module.exports = { SelectionMixin };
