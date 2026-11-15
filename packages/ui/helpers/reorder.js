/**
 * The order after a drop (ADR-0026): the item at `from` moved to `to`, the
 * others keeping their order. A drop past either end lands at that end. The
 * list given is never changed.
 *
 * @param {Array} list
 * @param {number} from
 * @param {number} to
 * @returns {Array} a new list
 */
export function moveItem(list, from, to) {
  const moved = [...list];
  const target = Math.max(0, Math.min(to, moved.length - 1));
  const [item] = moved.splice(from, 1);
  moved.splice(target, 0, item);
  return moved;
}
