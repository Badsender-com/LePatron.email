'use strict';

const {
  BLOCK_WIDTH,
  MIN_COLUMN_WIDTH,
} = require('../../../../../../shared/block-builder/row-layout.js');
const {
  MAX_GUTTER,
} = require('../../../../../../shared/block-builder/row-spacing.js');

// The pieces of a row as the bar of the structure panel shows them — column,
// gutter, column… — and what resizing one does to the others. Plain functions
// over plain data, apart from the mixin that wires them to the panel
// (row-layout-bar.js).

const COLUMN = 'column';
const GUTTER = 'gutter';

/**
 * A row's layout as the bar shows it, left to right.
 *
 * @param {{widths: Array<number>, gutters: Array<number>}} layout
 * @returns {Array<{kind: string, number: number, size: number}>}
 */
function piecesOf({ widths, gutters }) {
  return widths.flatMap((width, index) => {
    const column = { kind: COLUMN, number: index + 1, size: width };
    return index === widths.length - 1
      ? [column]
      : [column, { kind: GUTTER, number: index + 1, size: gutters[index] }];
  });
}

/** The pieces back into a layout. */
const layoutOfPieces = (pieces) => ({
  widths: pieces.filter((p) => p.kind === COLUMN).map((p) => p.size),
  gutters: pieces.filter((p) => p.kind === GUTTER).map((p) => p.size),
});

const ownBounds = (piece) =>
  piece.kind === COLUMN
    ? { min: MIN_COLUMN_WIDTH, max: BLOCK_WIDTH }
    : { min: 0, max: MAX_GUTTER };

/**
 * The piece that gives or takes the room when a piece is resized: the next
 * one for a handle, the next column for a field.
 *
 * @param {Array<Object>} pieces
 * @param {number} index the piece resized
 * @param {boolean} [byField]
 * @returns {number}
 */
const neighbourOf = (pieces, index, byField) =>
  byField && pieces[index].kind === COLUMN ? index + 2 : index + 1;

/**
 * What a piece may measure, its neighbour taking or giving the difference:
 * both stay within their own bounds.
 *
 * @param {Array<Object>} pieces
 * @param {number} index
 * @param {boolean} [byField] see neighbourOf
 * @returns {{min: number, max: number}}
 */
function resizeBounds(pieces, index, byField) {
  const piece = pieces[index];
  const neighbour = pieces[neighbourOf(pieces, index, byField)];
  const pair = piece.size + neighbour.size;
  return {
    min: Math.max(ownBounds(piece).min, pair - ownBounds(neighbour).max),
    max: Math.min(ownBounds(piece).max, pair - ownBounds(neighbour).min),
  };
}

/**
 * The pieces once one is resized, or null when the size is not one it may
 * take: past its bounds, past its neighbour's, not a whole px, or a piece with
 * no neighbour to take from (the last column).
 *
 * @param {Array<Object>} pieces
 * @param {number} index
 * @param {number} size
 * @param {boolean} [byField] see neighbourOf
 * @returns {Array<Object>|null}
 */
function resize(pieces, index, size, byField) {
  if (index < 0 || index >= pieces.length - 1) return null;
  const neighbour = neighbourOf(pieces, index, byField);
  const { min, max } = resizeBounds(pieces, index, byField);
  if (!Number.isInteger(size) || size < min || size > max) return null;
  const pair = pieces[index].size + pieces[neighbour].size;
  return pieces.map((piece, at) => {
    if (at === index) return { ...piece, size };
    if (at === neighbour) return { ...piece, size: pair - size };
    return piece;
  });
}

/**
 * Which of two handles at the same place a drag means. A gutter at 0 puts the
 * handles on both its sides on one spot: dragging right there opens the
 * gutter, dragging left narrows the column before it.
 *
 * @param {Array<Object>} pieces
 * @param {number} handle the one the pointer went down on
 * @param {number} delta the first move, in px
 * @returns {number} the handle to move
 */
function handleForDrag(pieces, handle, delta) {
  const left = pieces[handle];
  const right = pieces[handle + 1];
  if (left.kind === COLUMN && right.size === 0 && delta > 0) return handle + 1;
  if (left.kind === GUTTER && left.size === 0 && delta < 0) return handle - 1;
  return handle;
}

module.exports = {
  COLUMN,
  GUTTER,
  piecesOf,
  layoutOfPieces,
  ownBounds,
  resizeBounds,
  resize,
  handleForDrag,
};
