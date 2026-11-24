'use strict';

// Rows: moving one, by drag or by keyboard.
//
// Apart from the row settings (row-settings.js), which set what a row IS —
// its structure and its widths — these change where it sits among the others.
//
// A Vue 2 mixin, like the row settings: every one of these reads or writes
// the component's `state` and its selection, and a mixin keeps `this` meaning
// the component.
//
// The component is expected to provide: `state`, `selectRow` (selection.js),
// `selectedRowId` and `selectedRowIndex` (row-settings.js). Nothing here asks
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
     * Moves a row to a position among the rows.
     *
     * `index` counts rows as they sit NOW, with the moved one still among
     * them — the same convention as an element's drop position, and the same
     * off-by-one if it is forgotten: taking the row out first shifts
     * everything after it up by one.
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
      const to = index > from ? index - 1 : index;
      if (to === from || to < 0 || to >= rows.length) return false;

      const [row] = rows.splice(from, 1);
      rows.splice(to, 0, row);
      return true;
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
