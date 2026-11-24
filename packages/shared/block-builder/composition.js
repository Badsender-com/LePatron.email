'use strict';

// The shape of a composition: rows, each holding columns, each column holding
// elements.
//
// Split out of state.js because reading a stored composition is now two jobs
// that have little to do with each other — bringing each element back to the
// keys its template declares, and bringing the structure around them back into
// something renderable. Everything here treats what it is given as HOSTILE: it
// has been in a database for months, written by an older version, possibly
// hand-edited, possibly truncated.

const { cleanElements, newRowId } = require('./stored-elements.js');

// Four is where a 600px email stops working: below roughly 60px a cell no
// longer holds a word, and Outlook's rounding of percentages starts to show.
const MAX_COLUMNS = 4;

// Same reasoning from the other end. A column narrower than this is not a
// layout choice, it is a mistake or a corrupted value.
const MIN_COLUMN_WIDTH = 10;

const FULL_WIDTH = 100;

/**
 * Whether a list of widths is one a row may have: one to MAX_COLUMNS finite
 * numbers, none below MIN_COLUMN_WIDTH, adding up to FULL_WIDTH.
 *
 * @param {Array<number>} widths
 * @returns {boolean}
 */
function areUsableWidths(widths) {
  if (!Array.isArray(widths) || widths.length === 0) return false;
  if (widths.length > MAX_COLUMNS) return false;
  if (!widths.every((width) => Number.isFinite(width))) return false;
  if (widths.some((width) => width < MIN_COLUMN_WIDTH)) return false;
  return widths.reduce((sum, width) => sum + width, 0) === FULL_WIDTH;
}

/**
 * Widths that add up, or equal shares.
 *
 * Deliberately all-or-nothing rather than clever. Clamping a too-narrow column
 * up and then rescaling can push another one below the floor, which clamps it
 * back up, and so on — the obvious fixes here do not converge. Equal shares
 * always land inside the limits, and the only way to reach this code is a
 * stored value the editor would never have written: the panel constrains what
 * a user can set.
 *
 * @param {Array<number>} widths one per column, at most MAX_COLUMNS
 * @returns {Array<number>}
 */
function usableWidths(widths) {
  if (areUsableWidths(widths)) return widths;

  const share = Math.floor(FULL_WIDTH / widths.length);
  // The remainder goes to the last column rather than being dropped: three
  // columns of 33 leave one percent, and a row that adds up to 99 renders a
  // sliver of background down one side.
  return widths.map((_, index) =>
    index === widths.length - 1
      ? FULL_WIDTH - share * (widths.length - 1)
      : share
  );
}

/**
 * A stored row brought back to something renderable.
 *
 * @param {*} row
 * @returns {Object} `{ id, columns }`
 */
function cleanRow(row) {
  const source = row && typeof row === 'object' ? row : {};
  const stored = Array.isArray(source.columns) ? source.columns : [];

  const columns = (stored.length === 0 ? [{}] : stored).map((column) => {
    const from = column && typeof column === 'object' ? column : {};
    return {
      width: typeof from.width === 'number' ? from.width : Number(from.width),
      elements: cleanElements(
        Array.isArray(from.elements) ? from.elements : []
      ),
    };
  });

  // Past the limit, the extra columns' elements are folded into the last one
  // we keep rather than dropped. A layout nobody can see any more is a visible,
  // fixable problem; a paragraph that silently disappeared is not.
  const kept = columns.slice(0, MAX_COLUMNS);
  const last = kept[kept.length - 1].elements;
  for (let index = MAX_COLUMNS; index < columns.length; index += 1) {
    for (const element of columns[index].elements) last.push(element);
  }

  const widths = usableWidths(kept.map((column) => column.width));

  return {
    id: typeof source.id === 'string' && source.id !== '' ? source.id : '',
    columns: kept.map((column, index) => ({
      width: widths[index],
      elements: column.elements,
    })),
  };
}

/**
 * The rows of a stored composition, whichever version wrote it.
 *
 * A composition written before columns is a flat list of elements. It reads as
 * one row of one full-width column — in memory, with nothing rewritten in the
 * database. That is the whole backward-compatibility story: a block composed
 * before this change reopens exactly as its author left it.
 *
 * @param {Object} parsed what came out of JSON.parse
 * @returns {Array<Object>}
 */
function readRows(parsed) {
  if (Array.isArray(parsed.rows)) {
    return parsed.rows.map(cleanRow);
  }

  const elements = cleanElements(
    Array.isArray(parsed.elements) ? parsed.elements : []
  );
  if (elements.length === 0) return [];

  return [{ id: '', columns: [{ width: FULL_WIDTH, elements }] }];
}

/**
 * Every element of a composition, in document order.
 *
 * @param {Array<Object>} rows
 * @returns {Array<Object>}
 */
function elementsOf(rows) {
  const listOf = (value) => (Array.isArray(value) ? value : []);
  const all = [];
  for (const row of listOf(rows)) {
    for (const column of listOf(row && row.columns)) {
      for (const element of listOf(column && column.elements)) {
        all.push(element);
      }
    }
  }
  return all;
}

module.exports = {
  MAX_COLUMNS,
  MIN_COLUMN_WIDTH,
  FULL_WIDTH,
  newRowId,
  areUsableWidths,
  readRows,
  elementsOf,
};
