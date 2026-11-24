'use strict';

// Moving an item within a list, to a DROP POSITION.
//
// A drop position counts the items as they sit NOW, with the moved one still
// among them: 0 is above the first, `list.length` below the last, and `from`
// or `from + 1` leave the item where it is. That is what a drag shows — the
// line drawn between two items — and what the arrows ask for. Taking the item
// out first shifts everything after it up by one, so a position past `from`
// comes down by one: the classic off-by-one of every reorder, written here
// once for the elements of a column and the rows of a block alike.

/**
 * Moves the item at `from` to a drop position, in place.
 *
 * A position outside the list is brought back to its nearest end, as a drop
 * is: past the last item means below it.
 *
 * @param {Array} list changed in place
 * @param {number} from the index of the item to move
 * @param {number} position the drop position, counted with the item in place
 * @returns {boolean} whether the order changed
 */
function moveInList(list, from, position) {
  if (!Array.isArray(list)) return false;
  if (!Number.isInteger(from) || from < 0 || from >= list.length) return false;
  if (!Number.isInteger(position)) return false;

  const bounded = Math.max(0, Math.min(position, list.length));
  const to = bounded > from ? bounded - 1 : bounded;
  if (to === from) return false;

  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  return true;
}

module.exports = { moveInList };
