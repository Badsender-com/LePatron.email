'use strict';

const logger = require('../../utils/logger.js');
const ProviderFactory = require('../provider-factory.js');
const cache = require('./model-listing.cache.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../provider-error.js');
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

// Bounds what one listing may keep in the cache, whatever the endpoint sends.
// The largest real listing (OpenAI) is well under this.
const MAX_REMOTE_MODELS = 500;

// Listings in progress, by cache key. Both settings sections mount at once and
// ask for the same integration: without this, both miss the cache and the
// provider is called twice.
const inFlight = new Map();

/**
 * @param {Object} integration Mongoose integration document
 * @returns {Promise<{models: Array, source: string, error: string|null}>}
 *   `error` is a PROVIDER_ERROR_CODES value, never a raw message: it reaches
 *   the client, and a network error's message carries the address and port
 *   that were tried.
 */
async function listModelsForIntegration(integration) {
  const providerKey = integration.provider;
  const catalogModels = getCatalogModels(providerKey);

  const { remoteModels, error } = await loadRemoteModels(integration);

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
async function loadRemoteModels(integration) {
  const cached = cache.get(integration);
  if (cached) {
    return { remoteModels: cached.models, error: cached.error };
  }

  const key = cache.keyFor(integration);
  if (inFlight.has(key)) return inFlight.get(key);

  const pending = queryProvider(integration).finally(() =>
    inFlight.delete(key)
  );
  inFlight.set(key, pending);
  return pending;
}

async function queryProvider(integration) {
  let provider;
  try {
    provider = ProviderFactory.createProvider(integration);
  } catch (err) {
    // A provider that cannot even be constructed (missing productId, missing
    // host) is a configuration problem, not a transient one: surface it rather
    // than silently showing the catalogue as if all were well.
    logger.error(
      `Model listing: cannot build the ${integration.provider} provider:`,
      err.message
    );
    return { remoteModels: null, error: CODES.CONFIG_ERROR };
  }

  if (typeof provider.listRemoteModels !== 'function') {
    return { remoteModels: null, error: null };
  }

  try {
    const remoteModels = sanitizeRemoteModels(
      await provider.listRemoteModels()
    );
    cache.set(integration, { models: remoteModels });
    return { remoteModels, error: null };
  } catch (err) {
    logger.error(
      `Model listing failed for ${integration.provider}:`,
      err.message
    );
    const error = toErrorCode(err);
    cache.set(integration, { error });
    return { remoteModels: null, error };
  }
}

function toErrorCode(err) {
  if (err instanceof ProviderError && err.code) return err.code;
  return CODES.API_ERROR;
}

/**
 * Keep what the rest of this module can rely on. The listing comes from an
 * endpoint the group admin chose, so its shape is not ours to assume: an id
 * that is not a string would make the sort throw, and an unbounded list would
 * sit in the cache for ten minutes.
 *
 * `null` passes through: it means "no usable listing", not "empty".
 */
function sanitizeRemoteModels(models) {
  if (models === null || models === undefined) return null;
  if (!Array.isArray(models)) return [];

  const text = (value) => (typeof value === 'string' ? value : null);
  // Passed through as the provider sent it: read by isRetired, which accepts
  // whatever Date does.
  const date = (value) =>
    typeof value === 'string' || typeof value === 'number' ? value : null;
  return models
    .filter((model) => model && typeof model.id === 'string' && model.id)
    .slice(0, MAX_REMOTE_MODELS)
    .map((model) => ({
      id: model.id,
      label: text(model.label),
      description: text(model.description),
      shutdownDate: date(model.shutdownDate),
      replacedBy: text(model.replacedBy),
    }));
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
    // Already withdrawn: offering it would only produce a failing call.
    if (isRetired(remote.shutdownDate)) continue;

    const retiring = !!remote.shutdownDate;
    const entry = getCatalogEntry(providerKey, remote.id);
    if (entry) {
      known.push(
        decorate(
          { ...entry, description: remote.description || null },
          {
            known: true,
            remote: true,
            deprecated: entry.deprecated || retiring,
          }
        )
      );
    } else {
      remoteOnly.push(
        decorate(
          {
            id: remote.id,
            label: remote.label || remote.id,
            description: remote.description || null,
            order: 0,
          },
          { known: false, remote: true, deprecated: retiring }
        )
      );
    }
  }

  const unseen = catalogModels
    .filter((model) => !seen.has(model.id))
    .map((model) => decorate(model, { known: true, remote: false }));

  return [
    ...sortForDisplay(known),
    // Alphabetical within the group, but models on their way out go last here
    // too — this is where most of them are, since we describe few of them.
    ...remoteOnly.sort((a, b) => {
      if (!!a.deprecated !== !!b.deprecated) return a.deprecated ? 1 : -1;
      return a.id.localeCompare(b.id);
    }),
    ...sortForDisplay(unseen),
  ];
}

/**
 * Whether the provider says the model is already gone.
 *
 * OpenAI publishes `shutdown_date` and Mistral `deprecation`, so the list of
 * dead models does not have to be curated by hand — which is the only way it
 * would stay accurate.
 */
function isRetired(shutdownDate) {
  if (!shutdownDate) return false;
  const date = new Date(shutdownDate);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
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
function decorate(model, { known, remote, deprecated }) {
  return {
    id: model.id,
    label: model.label,
    // Written by the provider when it offers one (Mistral, Gemini). OpenAI and
    // Anthropic do not, which is why the catalogue's own i18n key stays.
    description: model.description || null,
    // `name` is the field the settings screens read (`m.name || m.id`).
    // Kept as an alias so the endpoint stays usable by a UI deployed before
    // this change.
    name: model.label,
    descriptionKey: model.descriptionKey,
    deprecated: deprecated === undefined ? !!model.deprecated : !!deprecated,
    order: model.order,
    known,
    remote,
  };
}

module.exports = { listModelsForIntegration, SOURCES };
