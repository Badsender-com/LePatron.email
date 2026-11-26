'use strict';

const {
  BLOCK_WIDTH,
  rowLayout,
} = require('../../../../../../shared/block-builder/row-layout.js');
const {
  GUTTERS_KEY,
  gutterTotal,
} = require('../../../../../../shared/block-builder/row-spacing.js');
const { typedNumber } = require('./row-spacing-settings.js');
const {
  COLUMN,
  piecesOf,
  layoutOfPieces,
  ownBounds,
  resizeBounds,
  resize,
  handleForDrag,
} = require('./row-layout-pieces.js');

// The bar of the structure panel: the 600px of the block, cut into its pieces
// — column, gutter, column, gutter… — each as wide as it is in the email
// (ADR 0025, "Row layout").
//
// Between two pieces, a handle: dragged, or moved from the keyboard as a
// slider, it widens the piece on its left and takes the room from the piece on
// its right, so the pieces always fill the block. Under the bar, a number field
// per piece sets it to the pixel, taking the room from the next COLUMN: typing
// a column's width should not eat the gutter beside it. The last column has no
// handle after it: it is what the others leave, and its field only shows it.
//
// A Vue 2 mixin, like the row settings beside it (row-settings.js). The
// component is expected to provide `vm`, and from selection.js `selectedRow`,
// `selectedRowId` and `rowById`; the template a `layoutBar` ref on the bar.

// A key press moves a handle one pixel, ten with Shift: the steps a slider
// usually takes.
const KEY_STEP = 1;
const KEY_STEP_LARGE = 10;
const KEY_DIRECTIONS = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
};

// The strings the bar builds with variables.
const ROW_LAYOUT_LABEL_KEYS = [
  'block-builder-column-label',
  'block-builder-gutter-label',
  'block-builder-column-width',
  'block-builder-gutter-width',
];

const clamp = (value, { min, max }) => Math.min(max, Math.max(min, value));

const RowLayoutBarMixin = {
  data: () => ({ layoutDrag: null }),

  computed: {
    layoutPieces() {
      const row = this.selectedRow;
      if (!row) return [];
      return piecesOf(
        rowLayout(
          row.columns.map((column) => column.width),
          row[GUTTERS_KEY]
        )
      );
    },
  },

  beforeDestroy() {
    this.endLayoutDrag();
  },

  methods: {
    pieceLabel(index) {
      const piece = this.layoutPieces[index];
      const key =
        piece.kind === COLUMN
          ? 'block-builder-column-label'
          : 'block-builder-gutter-label';
      return this.vm.t(key, { n: piece.number });
    },

    pieceLabelId(index) {
      return `bb-piece-${this._uid}-${index}`;
    },

    handleLabel(index) {
      const piece = this.layoutPieces[index];
      const key =
        piece.kind === COLUMN
          ? 'block-builder-column-width'
          : 'block-builder-gutter-width';
      return this.vm.t(key, { n: piece.number });
    },

    handleBounds(index) {
      return resizeBounds(this.layoutPieces, index);
    },

    // A field's bounds, or the piece's own for the last column, whose field
    // only shows what the others leave.
    pieceBounds(index) {
      return index < this.layoutPieces.length - 1
        ? resizeBounds(this.layoutPieces, index, true)
        : ownBounds(this.layoutPieces[index]);
    },

    /**
     * Gives a piece of a row a size, its neighbour taking the difference: the
     * next piece for a handle, the next column for a field (neighbourOf).
     * Refused rather than clamped when it does not fit: a typed value past a
     * bound is a mistake, and moving it silently would hide it.
     *
     * @param {string} rowId
     * @param {number} index the piece, left to right
     * @param {number} size in px
     * @param {boolean} [byField]
     * @returns {boolean} whether the row changed
     */
    setRowPiece(rowId, index, size, byField) {
      const row = this.rowById(rowId);
      if (!row || row.columns.length < 2) return false;
      const pieces = piecesOf(
        rowLayout(
          row.columns.map((column) => column.width),
          row[GUTTERS_KEY]
        )
      );
      const resized = resize(pieces, index, size, byField);
      if (!resized || resized[index].size === pieces[index].size) return false;

      const { widths, gutters } = layoutOfPieces(resized);
      row.columns.forEach((column, at) => {
        column.width = widths[at];
      });
      // Gutters all at 0 are not stored: the row reads as it did before them.
      if (gutterTotal(gutters) > 0) this.$set(row, GUTTERS_KEY, gutters);
      else if (GUTTERS_KEY in row) this.$delete(row, GUTTERS_KEY);
      return true;
    },

    // Put back to what the row holds whatever happened, as for the stack
    // spacing: a refused value leaves the state, and the field, as they were.
    onPieceChange(event, index) {
      const value = typedNumber(event.target);
      if (value !== null) {
        this.setRowPiece(this.selectedRowId, index, value, true);
      }
      event.target.value = this.layoutPieces[index].size;
    },

    onHandleKeydown(event, index) {
      const bounds = this.handleBounds(index);
      const size = this.layoutPieces[index].size;
      const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
      let target;
      if (event.key in KEY_DIRECTIONS) {
        target = size + KEY_DIRECTIONS[event.key] * step;
      } else if (event.key === 'Home') target = bounds.min;
      else if (event.key === 'End') target = bounds.max;
      else return;
      event.preventDefault();
      // Clamped, unlike a typed value: ten pixels from a bound that is three
      // away is a press that should still land on it.
      this.setRowPiece(this.selectedRowId, index, clamp(target, bounds));
    },

    onHandlePointerDown(event, index) {
      if (event.button !== undefined && event.button !== 0) return;
      const bar = this.$refs.layoutBar;
      const width = bar ? bar.getBoundingClientRect().width : 0;
      // Nothing laid out, nothing to measure a move against.
      if (!width) return;
      event.preventDefault();
      if (event.currentTarget && event.currentTarget.focus) {
        event.currentTarget.focus();
      }
      this.endLayoutDrag();
      this.layoutDrag = {
        handle: index,
        startX: event.clientX,
        scale: width / BLOCK_WIDTH,
        startSize: null,
      };
      this.layoutDragListeners = {
        pointermove: (move) => this.onLayoutDragMove(move),
        pointerup: () => this.endLayoutDrag(),
        pointercancel: () => this.endLayoutDrag(),
      };
      Object.entries(this.layoutDragListeners).forEach(([type, listener]) =>
        window.addEventListener(type, listener)
      );
    },

    onLayoutDragMove(event) {
      const drag = this.layoutDrag;
      if (!drag) return;
      const delta = Math.round((event.clientX - drag.startX) / drag.scale);
      // The handle is settled on the first move, when two share a place.
      if (drag.startSize === null) {
        if (delta === 0) return;
        drag.handle = handleForDrag(this.layoutPieces, drag.handle, delta);
        drag.startSize = this.layoutPieces[drag.handle].size;
      }
      const target = clamp(
        drag.startSize + delta,
        this.handleBounds(drag.handle)
      );
      this.setRowPiece(this.selectedRowId, drag.handle, target);
    },

    endLayoutDrag() {
      if (this.layoutDragListeners) {
        Object.entries(this.layoutDragListeners).forEach(([type, listener]) =>
          window.removeEventListener(type, listener)
        );
        this.layoutDragListeners = null;
      }
      this.layoutDrag = null;
    },
  },
};

module.exports = { RowLayoutBarMixin, ROW_LAYOUT_LABEL_KEYS };
