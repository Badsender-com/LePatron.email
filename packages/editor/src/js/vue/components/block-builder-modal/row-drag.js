'use strict';

const { DRAG_TYPE } = require('./drag-surface.js');
const { dropIndexAt, leavesInPlace } = require('./drop-line.js');

// Moving a row by dragging it in the list of rows: the start, the list under
// the cursor, the drop. The end is the one every drag shares (handleDragEnd,
// drag-surface.js).
//
// The whole gesture happens in the editor's own document, beside the preview
// and never in it: the preview refuses a row (drag-surface.js), and is not
// held still for one — nothing in it moves until the drop.
//
// A Vue 2 mixin, like the drag surface: what is being dragged, and where it
// would land, are the component's state between two events.
//
// The component is expected to provide: `state`, `selection`, `selectRow`
// (selection.js), `moveRow` (row-actions.js), `holdPage` (page-guard.js),
// and from drag-surface.js `draggingRowId`, `selectionBeforeDrag`,
// `endLostDrag` and `handleDragEnd`.

/**
 * The options of the row list an event happened over, in order.
 *
 * @param {Event} event bound on the list's wrapper
 * @returns {Element[]}
 */
const rowOptionsOf = (event) =>
  Array.prototype.slice.call(
    event.currentTarget.querySelectorAll('[role="option"]')
  );

const RowDragMixin = {
  data: () => ({
    // Where the row being dragged would land, as a drop position — counted
    // with the row still in place, as moveRow counts it — or null when no
    // line is drawn.
    rowDropIndex: null,
  }),

  methods: {
    /**
     * Picks up a row of the list.
     *
     * Started the way the palette starts its drag (handleDragStart), for the
     * same two reasons: the event must not reach `window`, where Mosaico's
     * page guard cancels every `dragstart`; and Firefox starts no drag
     * without `setData`. The row's `drag` events are kept from `window` too
     * (handleDrag), or the guard cancels the drop.
     *
     * The row is selected, so its structure shows while it moves; the
     * selection it replaced comes back if the drag ends without a drop.
     *
     * @param {string} rowId
     * @param {DragEvent} event
     */
    startRowDrag(rowId, event) {
      event.stopPropagation();
      this.endLostDrag();
      this.draggingRowId = rowId;
      if (event.dataTransfer) {
        event.dataTransfer.clearData();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(DRAG_TYPE, rowId);
      }
      this.selectionBeforeDrag = this.selection;
      this.selectRow(rowId);
      this.holdPage();
    },

    /**
     * Accepts a row over the list, and says where it would land.
     *
     * Anything else is left to reach the page, which refuses it — the
     * palette's drag lands in the preview, not here. A row is stopped here,
     * or the page would refuse it too.
     *
     * Measured on the midpoint of each row, as an element is in the preview:
     * over the lower half of the next row, the drop position is past it, and
     * the row goes down one place. Below the last row, at the end — which is
     * why the list leaves room under it during the drag.
     *
     * @param {DragEvent} event bound on the list's wrapper
     */
    handleRowDragOver(event) {
      if (!this.draggingRowId) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

      const index = dropIndexAt(rowOptionsOf(event), event.clientY);
      const from = (this.state.rows || []).findIndex(
        (row) => row.id === this.draggingRowId
      );
      // No line on either edge of the row itself: dropped there it stays.
      this.rowDropIndex = leavesInPlace(from, index) ? null : index;
    },

    // Leaving the list, not crossing from one row to the next.
    handleRowDragLeave(event) {
      const leaving = event.relatedTarget;
      if (leaving && event.currentTarget.contains(leaving)) return;
      this.rowDropIndex = null;
    },

    /**
     * Moves the row to where the cursor is.
     *
     * @param {DragEvent} event bound on the list's wrapper
     */
    handleRowDrop(event) {
      if (!this.draggingRowId) return;
      event.preventDefault();

      const id = this.draggingRowId;
      const index = dropIndexAt(rowOptionsOf(event), event.clientY);
      // Ended as a drop, not a cancel: the selection goes to the row moved.
      this.draggingRowId = null;
      this.handleDragEnd();
      this.moveRow(id, index);
    },
  },
};

module.exports = { RowDragMixin };
