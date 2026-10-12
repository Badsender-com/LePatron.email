'use strict';

/**
 * Parameter quirks learned at runtime, per model.
 *
 * Discovering a quirk costs one refused request. Without memory that cost is
 * paid on every call; with it, once per model.
 *
 * Same shape as model-listing.cache.js, and the same reasoning: per-process
 * and dependency-free. The server runs in a cluster, so each worker learns on
 * its own — the cost of that duplication is one extra refusal per worker per
 * model per TTL, not per request. A shared store would add a write on a read
 * path, a dependency and a failure mode to save a handful of refusals a day.
 *
 * Only discoveries are stored. A call that succeeds writes nothing, so a
 * missing entry means "nothing unusual known", never "checked and fine".
 */

// Far longer than the listing cache: a model's contract does not change by the
// hour. Bounded all the same, so a provider fixing its API is picked up
// without waiting for a deploy.
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;

const store = new Map();

/** @returns {Array<{param: string, action: string, to?: string}>} */
function list(key) {
  const entry = store.get(key);
  if (!entry) return [];
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return [];
  }
  return entry.quirks;
}

/**
 * Record a quirk for a model, keeping any already known for it.
 * Re-recording the same parameter replaces it rather than piling up.
 */
function add(key, quirk) {
  if (!quirk || !quirk.param) return;

  const known = list(key).filter((item) => item.param !== quirk.param);

  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    const now = Date.now();
    for (const [existing, entry] of store) {
      if (entry.expiresAt <= now) store.delete(existing);
    }
    if (store.size >= MAX_ENTRIES) {
      store.delete(store.keys().next().value);
    }
  }

  store.set(key, {
    quirks: [...known, quirk],
    expiresAt: Date.now() + TTL_MS,
  });
}

function clear() {
  store.clear();
}

module.exports = { list, add, clear, TTL_MS, MAX_ENTRIES };
