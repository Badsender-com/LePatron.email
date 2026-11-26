'use strict';

const {
  ELEMENT_ATTRIBUTE,
  COLUMN_ROW_ATTRIBUTE,
  COLUMN_INDEX_ATTRIBUTE,
} = require('../../../../../../shared/block-builder/generate.js');
const { dropIndexAt } = require('./drop-line.js');

// Where a drag would land, now that a composition has columns.
//
// The answer used to be one number: between which two elements. It is three —
// a row, a column, and a position inside that column — and it is read in that
// order, because the column decides which elements the position is counted
// among. Measuring the position first, across every element of the block,
// would put a drop in the left column at an index belonging to the right one.
//
// Plain functions rather than mixin methods, like drop-line.js beside it: none
// of this reads the component, only the preview document the generator marked
// up with its editing chrome. What the component keeps of the answer is
// column-target.js.

const inside = (box, x, y) =>
  x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;

/**
 * How far a point is from a box, zero when it is inside.
 *
 * Vertical distance counts for more than horizontal: a cursor below the last
 * row belongs to the column it is under, not to whichever one its horizontal
 * position happens to graze.
 */
function distanceTo(box, x, y) {
  const dx = Math.max(box.left - x, 0, x - box.right);
  const dy = Math.max(box.top - y, 0, y - box.bottom);
  return dy * 2 + dx;
}

/**
 * The columns of the preview, in document order.
 *
 * @param {Document} doc
 * @returns {Element[]}
 */
function previewColumns(doc) {
  if (!doc || !doc.body) return [];
  return Array.prototype.slice.call(
    doc.body.querySelectorAll(`[${COLUMN_ROW_ATTRIBUTE}]`)
  );
}

/**
 * The elements of one column, in document order.
 *
 * Scoped to the column, which is what makes the position mean anything: the
 * same index in two columns is two different places.
 *
 * @param {Element} column
 * @returns {Element[]}
 */
function columnElements(column) {
  if (!column) return [];
  return Array.prototype.slice.call(
    column.querySelectorAll(`[${ELEMENT_ATTRIBUTE}]`)
  );
}

/**
 * The cell a column's chrome sits in: what the user sees as the column.
 *
 * The chrome is a box inside the cell, as tall as what it holds. Measured
 * instead of the cell, the blank under a short column belonged to no column,
 * and the nearest one — its neighbour — took the drop.
 *
 * @param {Element} column
 * @returns {Element}
 */
const cellOf = (column) => column.closest('td') || column;

/**
 * The target a column gives, with what the drop line needs to draw it.
 *
 * @param {Element} column the column's chrome, or the body of a flat preview
 * @param {string} rowId
 * @param {number} columnIndex
 * @param {number} clientY
 * @param {DOMRect|null} box the cell's box, or null for a flat preview, which
 *   is one column as wide as the document
 */
function targetIn(column, rowId, columnIndex, clientY, box) {
  const elements = columnElements(column);
  return {
    rowId,
    columnIndex,
    index: dropIndexAt(elements, clientY),
    column,
    elements,
    box,
  };
}

/**
 * Where a drag released at this point would land.
 *
 * A point outside every column still lands somewhere: the nearest one. A drag
 * released a few pixels past the edge of the block is a drop the user meant,
 * and refusing it reads as the gesture having failed.
 *
 * A flat composition — one row of one full-width column — renders exactly as
 * it did before columns (generate.js), so its preview carries no column
 * chrome. Its whole document is then that one column, and `flatRowId` names
 * the row it belongs to.
 *
 * The column and its elements come with the answer, so whoever draws the line
 * does not look them up a second time.
 *
 * @param {Document} doc the preview document
 * @param {number} clientX
 * @param {number} clientY
 * @param {string|null} [flatRowId] the id of the row a flat preview renders,
 *   when it renders one (renderedFlatRow)
 * @returns {{rowId: string, columnIndex: number, index: number,
 *   column: Element, elements: Element[], box: DOMRect|null}|null} null when
 *   the preview holds no column at all
 */
function dropTargetAt(doc, clientX, clientY, flatRowId) {
  if (!doc || !doc.body) return null;
  const columns = previewColumns(doc);
  if (columns.length === 0) {
    return flatRowId ? targetIn(doc.body, flatRowId, 0, clientY, null) : null;
  }

  const boxes = columns.map((column) =>
    cellOf(column).getBoundingClientRect()
  );
  let best = boxes.findIndex((box) => inside(box, clientX, clientY));
  if (best === -1) {
    const distances = boxes.map((box) => distanceTo(box, clientX, clientY));
    best = distances.indexOf(Math.min(...distances));
  }

  const column = columns[best];
  return targetIn(
    column,
    column.getAttribute(COLUMN_ROW_ATTRIBUTE),
    Number(column.getAttribute(COLUMN_INDEX_ATTRIBUTE)),
    clientY,
    boxes[best]
  );
}

module.exports = { dropTargetAt, previewColumns, columnElements };
