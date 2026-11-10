'use strict';

/**
 * A cache in memory, per process, bounded by the total size of what it keeps
 * and, when given, by how long it keeps each entry. Past the budget, the
 * entries read least recently go first (a Map keeps insertion order, and a
 * read moves its entry to the end).
 *
 * @param {Object} options
 * @param {number} options.budget the total size kept, in the unit of `sizeOf`
 * @param {Function} options.sizeOf the size of a value
 * @param {number} [options.maxEntry=budget] a larger value is never kept
 * @param {number} [options.ttlMs=Infinity] how long an entry is kept
 * @param {Function} [options.now] clock, for tests
 * @returns {{ get: Function, set: Function, has: Function }}
 */
function createSizedCache({
  budget,
  sizeOf,
  maxEntry = budget,
  ttlMs = Infinity,
  now = Date.now,
}) {
  const entries = new Map();
  let size = 0;

  function drop(key) {
    size -= entries.get(key).size;
    entries.delete(key);
  }

  function get(key) {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (now() >= entry.expiresAt) {
      drop(key);
      return undefined;
    }
    entries.delete(key);
    entries.set(key, entry);
    return entry.value;
  }

  function set(key, value) {
    const entrySize = sizeOf(value);
    if (entrySize > maxEntry) return;
    if (entries.has(key)) drop(key);
    entries.set(key, { value, size: entrySize, expiresAt: now() + ttlMs });
    size += entrySize;
    while (size > budget) drop(entries.keys().next().value);
  }

  return { get, set, has: (key) => get(key) !== undefined };
}

module.exports = { createSizedCache };
