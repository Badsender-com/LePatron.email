'use strict';

/**
 * In-process cache for remote model listings.
 *
 * The settings screen calls the listing endpoint every time it is opened, and
 * each call is a round trip to the provider. Caching the raw listing keeps the
 * screen responsive without making the list stale for long.
 *
 * Only the raw remote result is cached; the merge with the catalogue is pure
 * and cheap, so it runs on every request and picks up catalogue changes from a
 * deploy immediately.
 *
 * Deliberately per-process and dependency-free: each worker keeps its own
 * copy, so two workers can disagree for at most one TTL on a list that is only
 * ever displayed. That does not justify a shared store.
 */

const TTL_MS = 10 * 60 * 1000;
// Failures are cached far more briefly: long enough to stop hammering an API
// that is down while an admin reloads, short enough that fixing a bad key
// feels immediate.
const ERROR_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 200;

const store = new Map();

/**
 * Cache key for an integration.
 *
 * Including `updatedAt` is what invalidates the entry when the API key or host
 * changes: editing an integration writes a new timestamp, so the old listing
 * becomes unreachable instead of lingering under the same id. No explicit
 * invalidation hook to forget on a new write path.
 */
function cacheKey(integration) {
  const updatedAt = integration.updatedAt
    ? new Date(integration.updatedAt).getTime()
    : 0;
  return `${integration._id}:${updatedAt}`;
}

function get(integration) {
  const entry = store.get(cacheKey(integration));
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(cacheKey(integration));
    return null;
  }
  return entry;
}

function set(integration, { models, error }) {
  if (store.size >= MAX_ENTRIES) {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) store.delete(key);
    }
    // Still full of live entries: drop the oldest insertion (Map preserves it)
    // rather than grow without bound.
    if (store.size >= MAX_ENTRIES) {
      store.delete(store.keys().next().value);
    }
  }

  store.set(cacheKey(integration), {
    models: models || null,
    error: error || null,
    expiresAt: Date.now() + (error ? ERROR_TTL_MS : TTL_MS),
  });
}

function clear() {
  store.clear();
}

module.exports = { get, set, clear, TTL_MS, ERROR_TTL_MS };
