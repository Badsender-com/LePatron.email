'use strict';

// The space between the columns of a row: two settings, independent of each
// other, stored on the row (ADR 0025, "Row layout").
//
//   - the GUTTERS are the horizontal spaces between the columns on a desktop,
//     one per interval, never on the outer edges of the row;
//   - the STACK SPACING is the vertical space between the columns once they
//     stack on a phone, only ever between two columns that hold something.
//
// Both only mean something for a row of several columns. A row of one column
// carries neither, so it stays the flat composition it always was (see
// flatRowOf in composition.js).
//
// The bounds and the normalisation live here and nowhere else: the stored
// state is read through them (composition.js, row-layout.js), the generator
// renders through them (row-markup.js), and the modal sets through them.

const GUTTERS_KEY = 'gutters';
const STACK_SPACING_KEY = 'stackSpacing';
const SPACING_KEYS = Object.freeze([GUTTERS_KEY, STACK_SPACING_KEY]);

// Forty pixels between two columns of a 600px email is already a lot: three
// such gutters leave a fifth of the width to the gutters.
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
 * @param {*} value one stored gutter
 * @returns {number} whole px, 0 to MAX_GUTTER
 */
const normaliseGutter = (value) => boundedSpacing(value, MAX_GUTTER);

/**
 * The gutters of a row of `columnCount` columns: one per interval, each
 * normalised, 0 where nothing usable is stored. Extra entries are dropped.
 *
 * @param {*} stored the row's `gutters`
 * @param {number} columnCount
 * @returns {Array<number>}
 */
function normaliseGutters(stored, columnCount) {
  const list = Array.isArray(stored) ? stored : [];
  return Array.from({ length: Math.max(0, columnCount - 1) }, (_, index) =>
    normaliseGutter(list[index])
  );
}

/** @param {Array<number>} gutters normalised */
const gutterTotal = (gutters) =>
  gutters.reduce((total, gutter) => total + gutter, 0);

/**
 * @param {*} value a stored stack spacing
 * @returns {number} whole px, 0 to MAX_STACK_SPACING, on a STACK_SPACING_STEP
 */
function normaliseStackSpacing(value) {
  const bounded = boundedSpacing(value, MAX_STACK_SPACING);
  return Math.round(bounded / STACK_SPACING_STEP) * STACK_SPACING_STEP;
}

/**
 * The stack spacing a row renders with: 0 for a row of fewer than two
 * columns, whatever it holds.
 *
 * @param {Object} row as stored or edited
 * @param {number} columnCount how many columns the row renders
 * @returns {number}
 */
function rowStackSpacing(row, columnCount) {
  if (!row || typeof row !== 'object' || columnCount < 2) return 0;
  return normaliseStackSpacing(row[STACK_SPACING_KEY]);
}

/**
 * The spacing keys a row is stored with: only those that say something, so a
 * row at the defaults is stored exactly as it was before the settings existed.
 *
 * @param {Object} row as stored or edited
 * @param {number} columnCount
 * @returns {Object} `{ gutters?, stackSpacing? }`
 */
function storedSpacing(row, columnCount) {
  const source = row && typeof row === 'object' ? row : {};
  const gutters = normaliseGutters(source[GUTTERS_KEY], columnCount);
  const stackSpacing = rowStackSpacing(source, columnCount);
  return {
    ...(gutterTotal(gutters) > 0 ? { [GUTTERS_KEY]: gutters } : {}),
    ...(stackSpacing > 0 ? { [STACK_SPACING_KEY]: stackSpacing } : {}),
  };
}

module.exports = {
  GUTTERS_KEY,
  STACK_SPACING_KEY,
  SPACING_KEYS,
  MAX_GUTTER,
  MAX_STACK_SPACING,
  STACK_SPACING_STEP,
  normaliseGutter,
  normaliseGutters,
  gutterTotal,
  normaliseStackSpacing,
  rowStackSpacing,
  storedSpacing,
};
