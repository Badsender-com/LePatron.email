'use strict';

/**
 * Counts events per key over a sliding window: `hit(key)` records one and
 * says whether the key was still under `limit` for the last `windowMs`.
 *
 * In memory: under cluster (index.js) each worker counts on its own, so a
 * limit set here holds per worker.
 *
 * @param {Object} options
 * @param {number} options.windowMs
 * @param {number} options.limit
 * @param {number} [options.purgeEveryMs] - how often the keys whose hits
 *   all expired are dropped, a tenth of the window unless said otherwise
 */
function windowCounter({ windowMs, limit, purgeEveryMs = windowMs / 10 }) {
  const hits = new Map(); // key -> timestamps, oldest first
  let lastPurge = -Infinity;

  const recent = (times, now) => times.filter((at) => at > now - windowMs);

  // A key seen once must not stay forever, but walking every key on each hit
  // costs as much as there are keys: at most once per purgeEveryMs. The key
  // hit is always read fresh.
  function purge(now) {
    if (now - lastPurge < purgeEveryMs) return;
    lastPurge = now;
    hits.forEach((times, key) => {
      const kept = recent(times, now);
      if (kept.length) hits.set(key, kept);
      else hits.delete(key);
    });
  }

  return {
    /** @returns {boolean} false when `key` has met the limit (not recorded) */
    hit(key, now = Date.now()) {
      purge(now);
      const times = recent(hits.get(key) || [], now);
      if (times.length >= limit) {
        hits.set(key, times);
        return false;
      }
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
