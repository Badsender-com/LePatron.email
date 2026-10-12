'use strict';

/**
 * Counts events per key over a sliding window: `hit(key)` records one and
 * says whether the key was still under `limit` for the last `windowMs`.
 *
 * In memory: under cluster (index.js) each worker counts on its own, so a
 * limit set here holds per worker.
 *
 * @param {{ windowMs: number, limit: number }} options
 */
function windowCounter({ windowMs, limit }) {
  const hits = new Map(); // key -> timestamps, oldest first

  // Expired entries go at every call: a key seen once must not stay forever.
  function purge(now) {
    const since = now - windowMs;
    hits.forEach((times, key) => {
      const kept = times.filter((at) => at > since);
      if (kept.length) hits.set(key, kept);
      else hits.delete(key);
    });
  }

  return {
    /** @returns {boolean} false when `key` has met the limit (not recorded) */
    hit(key, now = Date.now()) {
      purge(now);
      const times = hits.get(key) || [];
      if (times.length >= limit) return false;
      hits.set(key, times.concat(now));
      return true;
    },
    /** Keys currently counted, for whoever wants to watch the table grow. */
    size() {
      return hits.size;
    },
    clear() {
      hits.clear();
    },
  };
}

module.exports = { windowCounter };
