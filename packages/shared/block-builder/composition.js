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
const lookup = require('./composition-lookup.js');

const { withoutEmptyRows } = lookup;

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

const listOf = (value) => (Array.isArray(value) ? value : []);
/**
 * The row a flat composition is written from, or null when it is not flat.
 *
 * Flat is what is WRITTEN being one row of one full-width column, nothing set
 * on either (a setting is a key beyond the bare ones): the shape a composition
 * stored before columns reads as, written back and rendered as it always was.
 * Judged on the rows withoutEmptyRows keeps, so a flat block with an empty row
 * added is still that block, byte for byte. A composition holding nothing is
 * judged on its first row, the one a new element lands in.
 *
 * @param {Object} state
 * @returns {Object|null}
 */
function flatRowOf(state) {
  const all = listOf(state && state.rows);
  const written = withoutEmptyRows(all);
  const rows = written.length > 0 ? written : all.slice(0, 1);
  if (rows.length !== 1) return null;

  const [row] = rows;
  if (!isObject(row) || !hasOnlyKeys(row, BARE_ROW_KEYS)) return null;
  if (!Array.isArray(row.columns) || row.columns.length !== 1) return null;

  const [column] = row.columns;
  const bare =
    isObject(column) &&
    hasOnlyKeys(column, BARE_COLUMN_KEYS) &&
    column.width === FULL_WIDTH &&
    Array.isArray(column.elements);
  return bare ? row : null;
}

/** Whether a composition is a flat list of elements: see flatRowOf. */
const isFlatComposition = (state) => flatRowOf(state) !== null;

/**
 * The element list of a flat composition's only column, or null when the
 * composition is not flat: the live array, so a splice into it changes the
 * composition. That is every element a flat composition holds.
 *
 * @param {Object} state
 * @returns {Array<Object>|null}
 */
function singleColumnElements(state) {
  const row = flatRowOf(state);
  return row ? row.columns[0].elements : null;
}

module.exports = {
  MAX_COLUMNS,
  MAX_ROWS,
  MIN_COLUMN_WIDTH,
  FULL_WIDTH,
  newRowId,
  areUsableWidths,
  usableWidths,
  singleColumnRows,
  readRows,
  holdsNothing,
  // Finding things in a composition lives in a module of its own, and is
  // reached through this one: composition.js stays the one door to the shape.
  ...lookup,
  flatRowOf,
  isFlatComposition,
  singleColumnElements,
};
