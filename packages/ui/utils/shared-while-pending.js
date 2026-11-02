// One request for two callers that ask for the same thing at the same time.
// Keyed by owner (a store): on the server, one module serves every request,
// so nothing may be shared between two owners.
const pending = new WeakMap();

/**
 * @param {Object} owner whose requests are shared, eg. the Vuex store
 * @param {string} key what is asked, eg. the route and its parameters
 * @param {Function} run sends the request; called unless the same key is
 *   already on its way for that owner
 * @returns {Promise} what `run` resolves to, shared
 */
export async function sharedWhilePending(owner, key, run) {
  const current = pending.get(owner);
  if (current && current.key === key) return current.promise;

  const promise = run();
  pending.set(owner, { key, promise });
  try {
    return await promise;
  } finally {
    if (pending.get(owner)?.promise === promise) pending.delete(owner);
  }
}
