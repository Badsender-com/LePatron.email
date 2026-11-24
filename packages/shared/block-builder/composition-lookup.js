'use strict';

// Finding things in a composition: every element in document order, and the
// rows that hold anything.
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
  withoutEmptyRows,
};
