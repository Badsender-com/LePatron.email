'use strict';

/**
 * Where a key moves the keyboard focus in a grid of `count` images laid out
 * `columns` to a row, in list order. Left and right step through the list,
 * up and down by a row, Home and End to either end. At an edge the focus
 * stays put, and the key is still the grid's: an arrow left to the browser
 * would scroll the grid under the focused image.
 *
 * @param {string} key a KeyboardEvent `key`
 * @param {number} index the image the focus is on
 * @param {number} count how many images the grid shows
 * @param {number} columns how many images a row holds
 * @returns {number|null} the image to focus, or null for a key the grid
 *   does not handle
 */
function nextIndex(key, index, count, columns) {
  const last = count - 1;
  switch (key) {
    case 'ArrowLeft':
      return Math.max(index - 1, 0);
    case 'ArrowRight':
      return Math.min(index + 1, last);
    case 'ArrowUp':
      return index - columns >= 0 ? index - columns : index;
    case 'ArrowDown':
      return rowBelow(index, last, columns);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}

// The last row may be cut short: down from above its end lands on the last
// image rather than nowhere, as a file manager does.
function rowBelow(index, last, columns) {
  if (index + columns <= last) return index + columns;
  const lastRow = Math.floor(last / columns);
  return Math.floor(index / columns) < lastRow ? last : index;
}

module.exports = { nextIndex };
