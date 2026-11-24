'use strict';

const {
  newRowId,
  canAddRow,
} = require('../../../../../../shared/block-builder/composition.js');
const {
  newElementId,
} = require('../../../../../../shared/block-builder/state.js');
const {
  moveInList,
} = require('../../../../../../shared/block-builder/move-in-list.js');

// Rows: moving one, duplicating one, and deleting it — the operations, and the
// buttons of the selected row's bar that call them.
//
// Apart from the row settings (row-settings.js), which set what a row IS —
// its structure and its widths — these act on the row as a whole.
//
// A Vue 2 mixin, like the row settings: every one of these reads or writes
// the component's `state` and its selection, and a mixin keeps `this` meaning
// the component.
//
// The component is expected to provide: `state`, `selectRow`,
// `selectElement`, `rowById` (selection.js), `selectedRowId` and
// `selectedRowIndex` (row-settings.js). Nothing here asks
// for a render: the preview watches its markup, and a row that moved changed
// it.

// The keys that move a row, with Alt held. Alt because the arrows alone walk
// the list (listbox.js), as they do in the element list: a keyboard user who
// learnt one list has learnt the other, and the same key moving a row in one
// and walking the other would be a trap.
const MOVE_KEYS = { ArrowUp: -1, ArrowDown: 1 };

// What the list announces, in the notation aria-keyshortcuts expects.
const MOVE_SHORTCUTS = 'Alt+ArrowUp Alt+ArrowDown';

const RowActionsMixin = {
  computed: {
    rowMoveShortcuts() {
      return MOVE_SHORTCUTS;
    },
  },

  methods: {
    /**
     * Moves a row to a drop position among the rows.
     *
     * `index` counts rows as they sit NOW, with the moved one still among
     * them — the convention of every move in the builder (move-in-list.js):
     * 0 is above the first row, `rows.length` below the last.
     *
     * @param {string} rowId
     * @param {number} index
     * @returns {boolean} whether the order changed
     */
    moveRow(rowId, index) {
      const rows = this.state.rows || [];
      const from = rows.findIndex((row) => row.id === rowId);
      if (from === -1) return false;

      this.selectRow(rowId);
      return moveInList(rows, from, index);
    },

    // The keyboard path, through the same move so the splice exists once.
    // One place down is past the next row, two positions on.
    moveSelectedRow(offset) {
      if (!this.canMoveRow(offset)) return false;
      const target = this.selectedRowIndex + offset;
      return this.moveRow(
        this.selectedRowId,
        offset > 0 ? target + 1 : target
      );
    },

    /**
     * Duplicates a row, placing the copy directly below it.
     *
     * This is what makes repetitive structures usable — three product lines
     * are composed once and duplicated twice — and it is also the answer to
     * what a composed block gives up by holding several rows: Mosaico can
     * duplicate a block, but a row inside one is only reachable from here.
     *
     * A deep copy with fresh ids throughout. A shared id would make the two
     * rows the same row as far as selection and drag are concerned, so
     * editing one would appear to edit both; a shared OBJECT anywhere inside
     * would be worse still, since typing in one would change the other.
     * Copied through JSON, which a composition goes through anyway to be
     * stored (serialiseState): whatever survives that survives this, at any
     * depth, and whatever else the row and its columns hold comes with it,
     * as a change of width keeps it (setRowWidths).
     *
     * Refused at the row limit, like "Add a row": a copy is a row too, and
     * past MAX_ROWS the composition could not be read back.
     *
     * @param {string} rowId
     * @returns {Object|null} the copy, or null when the row is gone or the
     *   block is full
     */
    duplicateRow(rowId) {
      const source = this.rowById(rowId);
      if (!source || !canAddRow(this.state)) return null;

      const copy = JSON.parse(JSON.stringify(source));
      copy.id = newRowId();
      copy.columns.forEach((column) => {
        column.elements.forEach((element) => {
          element.id = newElementId();
        });
      });

      const { rows } = this.state;
      rows.splice(rows.indexOf(source) + 1, 0, copy);
      this.selectRow(copy.id);
      return copy;
    },

    /**
     * Removes a row, and the elements in it.
     *
     * The last row goes like any other: a composition with no row at all is
     * what an emptied block is, and the modal has to keep opening on it —
     * `handleToggle` puts an empty row back when there is none.
     *
     * @param {string} rowId
     * @returns {boolean} whether a row was removed
     */
    deleteRow(rowId) {
      const row = this.rowById(rowId);
      if (!row) return false;

      const { rows } = this.state;
      const at = rows.indexOf(row);
      rows.splice(at, 1);
      // Selection goes to the next row, or the previous one at the end, so the
      // panel is never left pointing at something that is gone. With no row
      // left, nothing is selected, and the palette makes a row again for the
      // next element (insertElement).
      const next = rows[at] || rows[at - 1];
      if (next) this.selectRow(next.id);
      else this.selectElement(null);
      return true;
    },

    duplicateSelectedRow() {
      return this.selectedRowId ? this.duplicateRow(this.selectedRowId) : null;
    },

    deleteSelectedRow() {
      return this.selectedRowId ? this.deleteRow(this.selectedRowId) : false;
    },

    canMoveRow(offset) {
      const from = this.selectedRowIndex;
      const target = from + offset;
      return (
        from !== -1 && target >= 0 && target < (this.state.rows || []).length
      );
    },

    /**
     * Alt+↑ or Alt+↓ on a row of the list: selects that row and moves it one
     * place, the focus going with it.
     *
     * @param {KeyboardEvent} event
     * @param {number} index the row the key was pressed on
     * @returns {boolean} whether the key was one of these, so the list leaves
     *   it alone
     */
    moveRowByKey(event, index) {
      const offset = MOVE_KEYS[event.key];
      if (!event.altKey || !offset) return false;

      event.preventDefault();
      const row = (this.state.rows || [])[index];
      if (!row) return true;
      this.selectRow(row.id);
      if (!this.moveSelectedRow(offset)) return true;

      // The option is keyed by the row, so Vue moves its node rather than
      // rewriting it — and a node moved in the document loses the focus in
      // some browsers. Put back after the render, on the row's new place.
      this.$nextTick(() => {
        const found = this.$el.querySelectorAll(
          '.bb-modal__rows [role="option"]'
        );
        if (found[index + offset]) found[index + offset].focus();
      });
      return true;
    },
  },
};

module.exports = { RowActionsMixin, MOVE_KEYS };
