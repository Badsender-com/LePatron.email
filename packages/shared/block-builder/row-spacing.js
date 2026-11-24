'use strict';

// The space between the columns of a row: two settings, independent of each
// other, stored on the row (ADR 0025, "Row settings").
//
//   - the GUTTER is the horizontal space between the columns on a desktop,
//     never on the outer edges of the row;
//   - the STACK SPACING is the vertical space between the columns once they
//     stack on a phone, never after the last one.
//
// Both only mean something for a row of several columns. A row of one column
// carries neither, so it stays the flat composition it always was (see
// flatRowOf in composition.js).
//
// Every reader of a stored or edited row goes through `rowSpacing`, so no value
// reaches the markup or the stylesheet without being made an integer within
// the bounds first.

const GUTTER_KEY = 'gutter';
const STACK_SPACING_KEY = 'stackSpacing';
const SPACING_KEYS = Object.freeze([GUTTER_KEY, STACK_SPACING_KEY]);

// Forty pixels between two columns of a 600px email is already a lot: four
// columns leave a fifth of the width to gutters.
const MAX_GUTTER = 40;
const MAX_STACK_SPACING = 40;

// The stack spacing is applied by a generated class, one per value, and the
// stylesheet may only hold rules from a closed list (generated-classes.js). A
// step keeps that list short: ten classes rather than forty.
const STACK_SPACING_STEP = 4;

/**
 * A spacing as stored, made a whole number of px between 0 and `max`, or 0.
 *
 * Only a number is read. A string, even one that looks like a number, is not
 * something the editor writes, so it is dropped rather than guessed at.
 *
 * @param {*} value
 * @param {number} max
 * @returns {number}
 */
function boundedSpacing(value, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.round(value)));
}

/**
 * @param {*} value a stored gutter
 * @returns {number} whole px, 0 to MAX_GUTTER
 */
const normaliseGutter = (value) => boundedSpacing(value, MAX_GUTTER);

/**
 * @param {*} value a stored stack spacing
 * @returns {number} whole px, 0 to MAX_STACK_SPACING, on a STACK_SPACING_STEP
 */
function normaliseStackSpacing(value) {
  const bounded = boundedSpacing(value, MAX_STACK_SPACING);
  return Math.round(bounded / STACK_SPACING_STEP) * STACK_SPACING_STEP;
}

/**
 * The spacing a row renders with: both settings normalised, and both 0 for a
 * row of fewer than two columns, whatever it holds.
 *
 * @param {Object} row as stored or edited
 * @param {number} columnCount how many columns the row renders
 * @returns {{gutter: number, stackSpacing: number}}
 */
function rowSpacing(row, columnCount) {
  if (!row || typeof row !== 'object' || columnCount < 2) {
    return { gutter: 0, stackSpacing: 0 };
  }
  return {
    gutter: normaliseGutter(row[GUTTER_KEY]),
    stackSpacing: normaliseStackSpacing(row[STACK_SPACING_KEY]),
  };
}

/**
 * The spacing keys a row is stored with: only those that are not 0, so a row at
 * the defaults is stored exactly as it was before the settings existed.
 *
 * @param {Object} row
 * @param {number} columnCount
 * @returns {Object} `{ gutter?, stackSpacing? }`
 */
function storedSpacing(row, columnCount) {
  const { gutter, stackSpacing } = rowSpacing(row, columnCount);
  return {
    ...(gutter > 0 ? { [GUTTER_KEY]: gutter } : {}),
    ...(stackSpacing > 0 ? { [STACK_SPACING_KEY]: stackSpacing } : {}),
  };
}

/**
 * The padding a cell takes from the gutter: half of it on each side that faces
 * another column, none on the outer edges of the row. An odd gutter gives the
 * extra pixel to the right of the left column, so the two halves that meet
 * between two columns always add up to the gutter.
 *
 * @param {number} index the column's position in the row
 * @param {number} columnCount
 * @param {number} gutter normalised
 * @returns {{left: number, right: number}}
 */
function gutterSides(index, columnCount, gutter) {
  return {
    left: index === 0 ? 0 : Math.floor(gutter / 2),
    right: index === columnCount - 1 ? 0 : Math.ceil(gutter / 2),
  };
}

module.exports = {
  GUTTER_KEY,
  STACK_SPACING_KEY,
  SPACING_KEYS,
  MAX_GUTTER,
  MAX_STACK_SPACING,
  STACK_SPACING_STEP,
  normaliseGutter,
  normaliseStackSpacing,
  rowSpacing,
  storedSpacing,
  gutterSides,
};
