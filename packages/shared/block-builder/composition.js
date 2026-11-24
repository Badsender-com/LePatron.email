'use strict';

// The shape of a composition: rows, each holding columns, each column holding
// elements.
//
// In memory, a composition is ALWAYS rows — whichever version stored it. A
// composition stored before columns reads as one row of one full-width column,
// and a composition of that shape is written back the way it was stored (see
// isFlatComposition, and serialiseState in state.js).
//
// Everything here treats what it is given as HOSTILE: it has been in a database
// for months, written by an older version, possibly hand-edited, possibly
// truncated.

const {
  cleanElements,
  ensureUniqueIds,
  newRowId,
} = require('./stored-elements.js');

// Four is where a 600px email stops working: below roughly 60px a cell no
// longer holds a word, and Outlook's rounding of percentages starts to show.
const MAX_COLUMNS = 4;

// Far more rows than a block needs: a block is a section of an email, and a
// whole email is a column of blocks. A stored composition with more is not one
// the editor wrote, and it is refused rather than read.
const MAX_ROWS = 50;

// Same reasoning as MAX_COLUMNS from the other end. A column narrower than
// this is not a layout choice, it is a mistake or a corrupted value.
const MIN_COLUMN_WIDTH = 10;

const FULL_WIDTH = 100;

// What newRowId writes. A stored row id is kept only in that shape: anything
// else is replaced on read, so no free text rides along in a row id.
const ROW_ID = /^row-[0-9a-z]{1,16}-[0-9]{1,16}$/;

// The keys a row and a column hold when nothing about them was set. A key
// beyond these is a setting, and a setting makes the composition more than a
// flat list (see isFlatComposition).
const BARE_ROW_KEYS = ['id', 'columns'];
const BARE_COLUMN_KEYS = ['width', 'elements'];

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasOnlyKeys = (object, keys) =>
  Object.keys(object).every((key) => keys.includes(key));

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
 * @param {Object} source a stored row, already known to be an object
 * @returns {Object} `{ id, columns }`
 */
function cleanRow(source) {
  const stored = Array.isArray(source.columns) ? source.columns : [];

  const columns = (stored.length === 0 ? [{}] : stored).map((column) => {
    const from = isObject(column) ? column : {};
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
    id:
      typeof source.id === 'string' && ROW_ID.test(source.id) ? source.id : '',
    columns: kept.map((column, index) => ({
      width: widths[index],
      elements: column.elements,
    })),
  };
}

/**
 * Rows of one full-width column holding `elements`: what a composition stored
 * before columns reads as, and what a new one starts from.
 *
 * @param {Array<Object>} [elements]
 * @returns {Array<Object>}
 */
function singleColumnRows(elements) {
  return [
    {
      id: newRowId(),
      columns: [{ width: FULL_WIDTH, elements: elements || [] }],
    },
  ];
}

/**
 * The rows of a stored composition, whichever version wrote it, or null when
 * there are more than MAX_ROWS.
 *
 * A composition written before columns is a flat list of elements. It reads as
 * one row of one full-width column — in memory, with nothing rewritten in the
 * database. That is the whole backward-compatibility story: a block composed
 * before this change reopens exactly as its author left it.
 *
 * @param {Object} parsed what came out of JSON.parse
 * @returns {Array<Object>|null}
 */
function readRows(parsed) {
  let rows;
  if (Array.isArray(parsed.rows)) {
    // Counted on what is stored, before anything is read: an entry that turns
    // out not to be a row still counts, so a state cannot pad itself with
    // thousands of them and have each one looked at.
    if (parsed.rows.length > MAX_ROWS) return null;
    rows = parsed.rows.filter(isObject).map(cleanRow);
  } else {
    rows = singleColumnRows(
      cleanElements(Array.isArray(parsed.elements) ? parsed.elements : [])
    );
  }

  ensureUniqueIds(rows, newRowId);
  return rows;
}

/**
 * Whether a stored composition holds no element at all, judged on what is
 * stored rather than on what reading it would keep: an element of a type this
 * version does not know is still an element, and a composition made only of
 * those is not an empty one.
 *
 * @param {Object} parsed what came out of JSON.parse
 * @returns {boolean}
 */
function holdsNothing(parsed) {
  if (Array.isArray(parsed.elements) && parsed.elements.length > 0) {
    return false;
  }
  if (!Array.isArray(parsed.rows)) return true;
  if (parsed.rows.length > MAX_ROWS) return false;

  return parsed.rows.every(
    (row) =>
      !isObject(row) ||
      !Array.isArray(row.columns) ||
      row.columns.every(
        (column) =>
          !isObject(column) ||
          !Array.isArray(column.elements) ||
          column.elements.length === 0
      )
  );
}

/**
 * Every element of a list of rows, in document order: row by row, column by
 * column.
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
 * Whether a composition is a flat list of elements: exactly one row of exactly
 * one full-width column, with nothing set on either. That is the shape a
 * composition stored before columns reads as, and the one that is written back
 * the way it was stored — and rendered the way it always was.
 *
 * A row or column setting is a key beyond the bare ones, so any setting added
 * later makes a composition that uses it more than a flat list.
 *
 * @param {Object} state
 * @returns {boolean}
 */
function isFlatComposition(state) {
  const rows = state && state.rows;
  if (!Array.isArray(rows) || rows.length !== 1) return false;

  const [row] = rows;
  if (!isObject(row) || !hasOnlyKeys(row, BARE_ROW_KEYS)) return false;
  if (!Array.isArray(row.columns) || row.columns.length !== 1) return false;

  const [column] = row.columns;
  return (
    isObject(column) &&
    hasOnlyKeys(column, BARE_COLUMN_KEYS) &&
    column.width === FULL_WIDTH &&
    Array.isArray(column.elements)
  );
}

/**
 * The element list of the first column of the first row, or null: the live
 * array, so a splice into it changes the composition. For a flat composition,
 * that is every element it holds.
 *
 * @param {Object} state
 * @returns {Array<Object>|null}
 */
function singleColumnElements(state) {
  const row = state && Array.isArray(state.rows) ? state.rows[0] : null;
  const column = row && Array.isArray(row.columns) ? row.columns[0] : null;
  return column && Array.isArray(column.elements) ? column.elements : null;
}

module.exports = {
  MAX_COLUMNS,
  MAX_ROWS,
  MIN_COLUMN_WIDTH,
  FULL_WIDTH,
  newRowId,
  areUsableWidths,
  singleColumnRows,
  readRows,
  holdsNothing,
  elementsOf,
  elementsOfState,
  isFlatComposition,
  singleColumnElements,
};
