'use strict';

const logger = require('../../utils/logger.js');
const ProviderFactory = require('../provider-factory.js');
const cache = require('./model-listing.cache.js');
const {
  getCatalogModels,
  getCatalogEntry,
  passesRemoteFilter,
} = require('./model-catalog.js');

/**
 * Builds the model list shown to a group admin, from two sources.
 *
 * The provider's own API is the primary source: it is the only one that knows
 * what a given key may actually use, and what shipped after our last deploy.
 * The catalogue supplies curated labels, filters the noise out of listings
 * that mix model families, and takes over when the call fails or when the
 * provider has no usable listing at all.
 *
 * The screen must stay usable in every case, so nothing here throws: a failure
 * degrades to the catalogue and is reported alongside the list.
 */

const SOURCES = {
  MERGED: 'merged',
  CATALOG: 'catalog',
};

/**
 * @param {Object} integration Mongoose integration document
 * @param {Object} [options]
 * @param {boolean} [options.refresh] skip the cache and re-query the provider
 * @returns {Promise<{models: Array, source: string, error: string|null}>}
 */
async function listModelsForIntegration(integration, options = {}) {
  const providerKey = integration.provider;
  const catalogModels = getCatalogModels(providerKey);

  const { remoteModels, error } = await loadRemoteModels(integration, options);

  if (!remoteModels) {
    return {
      models: catalogModels.map((model) =>
        decorate(model, { known: true, remote: false })
      ),
      source: SOURCES.CATALOG,
      error,
    };
  }

  return {
    models: merge(providerKey, catalogModels, remoteModels),
    source: SOURCES.MERGED,
    error,
  };
}

/**
 * Fetch the provider listing, through the cache.
 *
 * `remoteModels: null` covers both "this provider has no usable listing" and
 * "the call failed" — the caller falls back to the catalogue either way, and
 * `error` is what distinguishes them for the UI.
 */
async function loadRemoteModels(integration, { refresh = false } = {}) {
  if (!refresh) {
    const cached = cache.get(integration);
    if (cached) {
      return { remoteModels: cached.models, error: cached.error };
    }
  }

  let provider;
  try {
    provider = ProviderFactory.createProvider(integration);
  } catch (err) {
    // A provider that cannot even be constructed (missing productId, missing
    // host) is a configuration problem, not a transient one: surface it rather
    // than silently showing the catalogue as if all were well.
    return { remoteModels: null, error: err.message };
  }

  if (typeof provider.listRemoteModels !== 'function') {
    return { remoteModels: null, error: null };
  }

  try {
    const remoteModels = await provider.listRemoteModels();
    cache.set(integration, { models: remoteModels });
    return { remoteModels, error: null };
  } catch (err) {
    logger.error(
      `Model listing failed for ${integration.provider}:`,
      err.message
    );
    cache.set(integration, { error: err.message });
    return { remoteModels: null, error: err.message };
  }
}

/**
 * Merge a remote listing with the catalogue.
 *
 * Catalogue labels win: they are curated and translated, where remote names
 * range from a proper display name to nothing at all. Entries the provider did
 * not report are kept rather than dropped — a group may have one persisted,
 * and some providers under-report — but they sort after what was seen live.
 */
function merge(providerKey, catalogModels, remoteModels) {
  const known = [];
  const remoteOnly = [];
  const seen = new Set();

  for (const remote of remoteModels) {
    if (seen.has(remote.id)) continue;
    seen.add(remote.id);
    if (!passesRemoteFilter(providerKey, remote.id)) continue;

    const entry = getCatalogEntry(providerKey, remote.id);
    if (entry) {
      known.push(decorate(entry, { known: true, remote: true }));
    } else {
      remoteOnly.push(
        decorate(
          { id: remote.id, label: remote.label || remote.id, order: 0 },
          { known: false, remote: true }
        )
      );
    }
  }

  const unseen = catalogModels
    .filter((model) => !seen.has(model.id))
    .map((model) => decorate(model, { known: true, remote: false }));

  return [
    ...sortForDisplay(known),
    ...remoteOnly.sort((a, b) => a.id.localeCompare(b.id)),
    ...sortForDisplay(unseen),
  ];
}

/** Deprecated models stay available but never lead the list. */
function sortForDisplay(models) {
  return models.sort((a, b) => {
    if (!!a.deprecated !== !!b.deprecated) return a.deprecated ? 1 : -1;
    return a.order - b.order;
  });
}

/**
 * @param {Object} model
 * @param {Object} flags
 * @param {boolean} flags.known  the catalogue describes this model
 * @param {boolean} flags.remote the provider reported it
 */
function decorate(model, { known, remote }) {
  return {
    id: model.id,
    label: model.label,
    // `name` is the field the settings screens read (`m.name || m.id`).
    // Kept as an alias so the endpoint stays usable by a UI deployed before
    // this change.
    name: model.label,
    descriptionKey: model.descriptionKey,
    deprecated: !!model.deprecated,
    order: model.order,
    known,
    remote,
  };
}

module.exports = { listModelsForIntegration, SOURCES };
