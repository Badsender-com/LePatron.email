'use strict';

const { COLUMN_TARGET_CLASS } = require('./preview-surface.js');
const {
  renderedFlatRow,
} = require('../../../../../../shared/block-builder/generate.js');
const {
  columnAt,
} = require('../../../../../../shared/block-builder/composition.js');
const { dropTargetAt } = require('./drop-target.js');

// The column a drag over the preview aims at: measured on each dragover, kept
// for the drop, and shown on the column itself.
//
// A Vue 2 mixin, like the drag it serves (drag-surface.js): the target is the
// component's state between two events. The measuring is drop-target.js,
// which reads only the preview document.
//
// The component is expected to provide `state`.

const ColumnTargetMixin = {
  created() {
    // Not reactive: nothing in the template renders off it. Where the drop
    // line currently says the drop will land — a row, a column, a position
    // inside it, and the column's node.
    this.dropTarget = null;
  },
  methods: {
    /**
     * The id of the row the preview renders flat, or null when it renders
     * columns.
     *
     * A flat preview carries no column chrome (generate.js), so its whole
     * document is that one column. Asked of renderedFlatRow, the rule the
     * preview is rendered by: with the chrome on, a second row — even an
     * empty one — makes it a preview of columns.
     */
    flatRowId() {
      const row = renderedFlatRow(this.state, { chrome: true });
      return row ? row.id : null;
    },

    /**
     * Measures where a drag at this event would land, and keeps it.
     *
     * @param {Document} doc the preview document
     * @param {DragEvent} event
     * @returns {Object|null} the target, see dropTargetAt
     */
    aimAt(doc, event) {
      const target = dropTargetAt(
        doc,
        event.clientX,
        event.clientY,
        this.flatRowId()
      );
      this.setDropTarget(target);
      return target;
    },

    /**
     * The target the indicator is showing, which is where a drop will land.
     *
     * Kept rather than measured again at drop time. With a column in the
     * answer the two can disagree: a cursor sitting between two cells resolves
     * to whichever is nearest, and a pixel of movement between the last
     * dragover and the release flips it. **The user drops where the line
     * is.** If the drop lands anywhere else, the indicator was a lie, and that
     * is the kind of bug nobody can report precisely.
     *
     * The column aimed at is marked too, which is what an empty column — no
     * element for a line to sit against — shows instead of a line.
     *
     * @param {Object|null} target null once the drag is over
     */
    setDropTarget(target) {
      const before = this.dropTarget && this.dropTarget.column;
      const after = target && target.box ? target.column : null;
      if (before && before !== after) {
        before.classList.remove(COLUMN_TARGET_CLASS);
      }
      if (after) after.classList.add(COLUMN_TARGET_CLASS);
      this.dropTarget = target;
    },

    // Every column accepts a drop, empty ones included — that is most of why
    // an empty column keeps a box worth aiming at.
    canDropInto(target) {
      return Boolean(columnAt(this.state, target));
    },
  },
};

module.exports = { ColumnTargetMixin };
