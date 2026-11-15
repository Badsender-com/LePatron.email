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

/**
 * The items in the order of their ids, shown before the server answers so a
 * second move starts from the first one. An item missing from the ids keeps
 * its place at the end; an id of no item is skipped.
 *
 * @param {Array<{id: *}>} items
 * @param {Array} ids
 * @returns {Array} a new list
 */
export function orderedBy(items, ids) {
  const byId = new Map(items.map((item) => [String(item.id), item]));
  const placed = ids.map(String).filter((id) => byId.has(id));
  const rest = items.filter((item) => !placed.includes(String(item.id)));
  return [...placed.map((id) => byId.get(id)), ...rest];
}
