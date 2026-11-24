'use strict';

// How a row shares the width of the block: its columns' widths and the
// gutters between them, in px (ADR 0025, "Row layout").
//
// A column's width is the width of its CONTENT: what an image in it is laid
// out at, exactly. The gutters sit between the columns, one per interval, and
// the columns and the gutters together fill the block. So two columns given
// the same width hold content of the same width, whatever gutters surround
// them.
//
// Everything here treats what it is given as hostile: a stored row, or the
// state the modal is editing, which nothing types. What comes out is always a
// layout the generator can render.

const { normaliseGutters, gutterTotal } = require('./row-spacing.js');

// The width a block is laid out for, in px. Email templates are built for
// 600px, and the generator lays images out for it: Outlook on Windows ignores
// `max-width` and takes an image's `width` attribute as it is.
const BLOCK_WIDTH = 600;

// What one column of the full width holds. Also the width the flat block, the
// one that stored no column at all, reads as.
const FULL_WIDTH = BLOCK_WIDTH;

// Four is where a 600px email stops working: below roughly 60px a cell no
// longer holds a word, and Outlook's rounding starts to show.
const MAX_COLUMNS = 4;

// The narrowest column: a tenth of the block. Narrower is not a layout choice,
// it is a mistake or a corrupted value. Four columns with the widest gutters
// still leave each one twice this.
const MIN_COLUMN_WIDTH = 60;

// Widths written before they were in px: whole percentages of the row, adding
// up to 100, none below 10. Never in production, but still read, so a
// composition saved on a test instance reopens as it was.
const LEGACY_FULL_WIDTH = 100;
const LEGACY_MIN_COLUMN_WIDTH = 10;

const sum = (values) => values.reduce((total, value) => total + value, 0);

/**
 * Whether these are widths a row may have between these gutters: one to
 * MAX_COLUMNS whole px, none below MIN_COLUMN_WIDTH, filling the block with
 * the gutters.
 *
 * @param {Array<number>} widths one per column, in px
 * @param {Array<number>} [gutters] normalised, one per interval
 * @returns {boolean}
 */
function areUsableWidths(widths, gutters = []) {
  if (!Array.isArray(widths) || widths.length === 0) return false;
  if (widths.length > MAX_COLUMNS) return false;
  if (!widths.every((width) => Number.isInteger(width))) return false;
  if (widths.some((width) => width < MIN_COLUMN_WIDTH)) return false;
  return sum(widths) + sum(gutters) === FULL_WIDTH;
}

/**
 * Whether these are widths in percent, as written before px.
 *
 * @param {Array<number>} widths
 * @returns {boolean}
 */
function areLegacyWidths(widths) {
  return (
    Array.isArray(widths) &&
    widths.length > 0 &&
    widths.length <= MAX_COLUMNS &&
    widths.every(
      (width) => Number.isInteger(width) && width >= LEGACY_MIN_COLUMN_WIDTH
    ) &&
    sum(widths) === LEGACY_FULL_WIDTH
  );
}

/**
 * Widths in px for proportions of the content width (what the block leaves
 * once the gutters are taken out). Rounded, the remainder going to the last
 * column so they fill it exactly.
 *
 * @param {Array<number>} proportions in percent, adding up to 100
 * @param {number} content the px the columns share
 * @returns {Array<number>}
 */
function widthsFromProportions(proportions, content) {
  const widths = proportions
    .slice(0, -1)
    .map((proportion) =>
      Math.round((content * proportion) / LEGACY_FULL_WIDTH)
    );
  return widths.concat(content - sum(widths));
}

/**
 * Equal shares of the content width, the remainder to the last column.
 *
 * Deliberately all-or-nothing rather than clever: clamping one column and
 * rescaling the others can push another below the floor, and the obvious
 * fixes do not converge. Equal shares always land inside the limits.
 *
 * @param {number} count
 * @param {number} content
 * @returns {Array<number>}
 */
function equalShares(count, content) {
  const share = Math.floor(content / count);
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? content - share * (count - 1) : share
  );
}

/**
 * The layout a row renders with: its widths in px and its gutters, always
 * usable. Widths that fill the block between the gutters are kept; widths in
 * percent are converted; anything else becomes equal shares.
 *
 * @param {Array<*>} storedWidths one per column, at most MAX_COLUMNS
 * @param {*} storedGutters as stored on the row
 * @returns {{widths: Array<number>, gutters: Array<number>}}
 */
function rowLayout(storedWidths, storedGutters) {
  const count = storedWidths.length;
  const gutters = normaliseGutters(storedGutters, count);
  const content = FULL_WIDTH - gutterTotal(gutters);

  if (areUsableWidths(storedWidths, gutters)) {
    return { widths: storedWidths, gutters };
  }
  if (areLegacyWidths(storedWidths)) {
    const widths = widthsFromProportions(storedWidths, content);
    if (areUsableWidths(widths, gutters)) return { widths, gutters };
  }
  return { widths: equalShares(count, content), gutters };
}

/**
 * Whether a width is the full width of the block, in either unit: a flat
 * block may be held as one column of either.
 *
 * @param {*} width
 * @returns {boolean}
 */
const isFullWidth = (width) =>
  width === FULL_WIDTH || width === LEGACY_FULL_WIDTH;

/**
 * A width in px as a percentage of the block, for the clients that read the
 * cell's style: up to four decimals, none when it is whole.
 *
 * @param {number} pixels
 * @returns {string} such as `50%` or `50.1667%`
 */
function percentOfBlock(pixels) {
  const percent = (pixels * LEGACY_FULL_WIDTH) / FULL_WIDTH;
  return `${Number(percent.toFixed(4))}%`;
}

/**
 * Whether a width in px is a whole percentage of the block: a multiple of
 * 6px, which a percentage writes without decimals.
 *
 * @param {number} pixels
 * @returns {boolean}
 */
const isWholePercent = (pixels) =>
  (pixels * LEGACY_FULL_WIDTH) % FULL_WIDTH === 0;

module.exports = {
  isWholePercent,
  BLOCK_WIDTH,
  FULL_WIDTH,
  MAX_COLUMNS,
  MIN_COLUMN_WIDTH,
  LEGACY_FULL_WIDTH,
  areUsableWidths,
  areLegacyWidths,
  widthsFromProportions,
  rowLayout,
  isFullWidth,
  percentOfBlock,
};
