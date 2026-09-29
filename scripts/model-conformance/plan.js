'use strict';

/**
 * Deciding which models to probe, and what that will cost.
 *
 * Pure: no Mongo, no network, no clock. This is the part worth testing, and
 * the part that decides how much a run spends.
 */

/**
 * Family of a model id, used to pick one representative rather than probing
 * every variant of the same contract.
 *
 * `gpt-4o-2024-08-06` and `gpt-4o` answer the same way; testing both buys
 * nothing. Dated suffixes and channel markers are stripped, then the first two
 * segments are kept — enough to separate gpt-5 from gpt-6, which is exactly
 * the distinction that mattered.
 */
function familyOf(id) {
  const base = String(id || '')
    .replace(/-\d{4}-\d{2}-\d{2}$/, '')
    .replace(/-(latest|preview|exp)$/, '');
  const parts = base.split('-');
  // The o-series names its generation in one segment (o3, o4) where gpt needs
  // two (gpt-5, gpt-4o). Keeping two for both would split o3 from o3-mini,
  // which share a contract.
  const width = /^o\d+$/.test(parts[0]) ? 1 : 2;
  return parts.slice(0, width).join('-') || base;
}

/**
 * Models worth probing for one integration.
 *
 * Three sets, unioned:
 *  - the catalogue, which is what the picker puts forward;
 *  - what groups actually configured, where a breakage is live today;
 *  - one representative per family among what the provider currently lists,
 *    which is where an unknown contract shows up first.
 *
 * Deterministic throughout: the representative is the first id in sort order,
 * never a random pick, so two runs are comparable.
 *
 * @param {Object} params
 * @param {string[]} params.catalogIds
 * @param {string[]} params.configuredIds  models set on a feature in DB
 * @param {string[]} params.listedIds      what listRemoteModels returned
 * @param {boolean} [params.all]           every listed model
 * @param {string[]} [params.only]         explicit ids, short-circuits the rest
 * @returns {string[]} sorted, deduplicated
 */
function selectModels({
  catalogIds = [],
  configuredIds = [],
  listedIds = [],
  all = false,
  only = null,
}) {
  if (only && only.length) return [...new Set(only)].sort();
  if (all) return [...new Set([...catalogIds, ...listedIds])].sort();

  const picked = new Set([...catalogIds, ...configuredIds]);

  const seenFamilies = new Set([...picked].map(familyOf));
  for (const id of [...listedIds].sort()) {
    const family = familyOf(id);
    if (seenFamilies.has(family)) continue;
    seenFamilies.add(family);
    picked.add(id);
  }

  return [...picked].sort();
}

/**
 * How many calls a plan will make, so it can be shown before spending it.
 *
 * @param {Array<{models: string[]}>} perIntegration
 * @param {number} pathCount 1 or 2
 * @param {number} samples
 */
function estimateCalls(perIntegration, pathCount, samples = 1) {
  const probes = perIntegration.reduce(
    (total, entry) => total + entry.models.length,
    0
  );
  return probes * pathCount * samples;
}

module.exports = { familyOf, selectModels, estimateCalls };
