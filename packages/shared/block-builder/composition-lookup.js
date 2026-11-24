'use strict';

// Finding things in a composition: every element in document order, the place
// of one element, a row by its id, a column by row and index, and the rows
// that hold anything.
//
// Plain readers over the in-memory shape (see composition.js), shared by the
// modal and the server so that "every element" and "where an element is" mean
// the same thing everywhere. They read what they are given defensively — a
// missing list is an empty one — and never write.

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const listOf = (value) => (Array.isArray(value) ? value : []);

/**
 * Walks every element of a list of rows, in document order — row by row,
 * column by column — until `visit` returns true.
 *
 * The one walk the readers below share, so that "every element" and "where an
 * element is" can never disagree on what a composition holds.
 *
 * @param {Array<Object>} rows
 * @param {function(Object, Object, Object, number): boolean|void} visit
 *   called with the element, its row, its column and its index there
 * @returns {{row: Object, column: Object, index: number}|null} where `visit`
 *   stopped, or null when it never did
 */
function walkElements(rows, visit) {
  for (const row of listOf(rows)) {
    for (const column of listOf(row && row.columns)) {
      const elements = listOf(column && column.elements);
      for (let index = 0; index < elements.length; index += 1) {
        if (visit(elements[index], row, column, index) === true) {
          return { row, column, index };
        }
      }
    }
  }
  return null;
}

/**
 * Every element of a list of rows, in document order: row by row, column by
 * column.
 *
 * @param {Array<Object>} rows
 * @returns {Array<Object>}
 */
function elementsOf(rows) {
  const all = [];
  walkElements(rows, (element) => {
    all.push(element);
  });
  return all;
}

/**
 * Every element of a composition, in document order, whatever its shape.
 *
 * The elements are the composition's own objects: a value written into one is
 * written into the composition.
 *
 * @param {Object} state
 * @returns {Array<Object>}
 */
const elementsOfState = (state) => elementsOf(state && state.rows);

/**
 * Where an element sits in a composition: its row, its column, and its index
 * in that column — the live objects, so a splice into `column.elements` moves
 * it. Searched across the whole composition, since an id is unique across it
 * (see readState in state.js).
 *
 * @param {Object} state
 * @param {string} id
 * @returns {{row: Object, column: Object, index: number}|null}
 */
function locateElement(state, id) {
  if (typeof id !== 'string' || id === '') return null;
  return walkElements(
    state && state.rows,
    (element) => isObject(element) && element.id === id
  );
}

/**
 * The row of a composition with this id, or null.
 *
 * @param {Object} state
 * @param {string} id
 * @returns {Object|null}
 */
function rowById(state, id) {
  if (typeof id !== 'string' || id === '') return null;
  return (
    listOf(state && state.rows).find((row) => isObject(row) && row.id === id) ||
    null
  );
}

/**
 * The column a target names — a row id and an index among its columns — or
 * null when there is none: the row is gone, the index is past its columns, or
 * the target names nothing.
 *
 * What a drop aims at, read back into the composition: the live column, so a
 * splice into its `elements` changes the composition.
 *
 * @param {Object} state
 * @param {{rowId: string, columnIndex: number}|null} target
 * @returns {Object|null}
 */
function columnAt(state, target) {
  if (!isObject(target) || !Number.isInteger(target.columnIndex)) return null;
  const row = rowById(state, target.rowId);
  const column = row ? listOf(row.columns)[target.columnIndex] : null;
  return isObject(column) && Array.isArray(column.elements) ? column : null;
}

/**
 * Whether a row holds at least one element, in any of its columns.
 *
 * @param {Object} row
 * @returns {boolean}
 */
const holdsElements = (row) =>
  isObject(row) &&
  listOf(row.columns).some(
    (column) => isObject(column) && listOf(column.elements).length > 0
  );

/**
 * The rows that are written: every row but those holding no element at all.
 *
 * A row with nothing in any column renders nothing (row-markup.js), so it is
 * not part of the email. Written anyway, it would make the state say more than
 * the markup, and turn a flat block into rows with different markup for a row
 * nobody can see. The state, the markup and the server that rebuilds one from
 * the other all read the rows through this, so they agree.
 *
 * Only whole rows go: an empty column beside content is part of the layout.
 *
 * @param {Array<Object>} rows
 * @returns {Array<Object>} the rows kept, the composition's own objects
 */
const withoutEmptyRows = (rows) => listOf(rows).filter(holdsElements);

module.exports = {
  elementsOf,
  elementsOfState,
  locateElement,
  rowById,
  columnAt,
  withoutEmptyRows,
};
