'use strict';

/**
 * Central catalogue of known chat models, one entry per provider.
 *
 * This replaces the per-class `getStaticModels()` / `DEFAULT_MODEL` pairs that
 * used to live in each provider. Those lists were the only source of truth for
 * what a group admin could pick, so they aged badly: a model released after a
 * deploy simply did not exist as far as LePatron was concerned.
 *
 * The catalogue is NOT that source of truth any more — `listRemoteModels()`
 * asks the provider's own API. The catalogue plays three narrower roles:
 *
 *   1. curated labels and descriptions for the models we know about,
 *   2. the noise filter for providers whose listing mixes in non-chat models
 *      (OpenAI returns embeddings, TTS, whisper and image models with no
 *      metadata saying which is which),
 *   3. the fallback when the listing call fails, or when a provider has no
 *      usable listing at all — Infomaniak's `/models` returns full model names
 *      its chat API refuses, so the catalogue is its only source.
 *
 * Kept as a plain module rather than a collection: it changes with provider
 * code, is identical for every group, and must be readable with no I/O —
 * `_getDefaultModel()` is called synchronously from `chatComplete`.
 */

/**
 * @typedef {Object} ModelEntry
 * @property {string} id            identifier sent verbatim to the provider
 * @property {string} label         display name (a product name, not translated)
 * @property {string} [descriptionKey] i18n key for the short qualifier
 * @property {boolean} [deprecated] sorted last and flagged; never removed, a
 *                                  group may still have it persisted
 * @property {number} order         sort order within the provider, ascending
 */

// Model ids are the contract with the provider APIs: changing one silently
// repoints every group that persisted it. The defaults below are the values
// that were hardcoded in the provider classes and are live for every group
// that never picked a model — they must not drift in the same change that
// introduces this file.
const CATALOG = {
  openai: {
    default: 'gpt-4o-mini',
    models: [
      {
        id: 'gpt-4o-mini',
        label: 'GPT-4o Mini',
        descriptionKey: 'integrations.models.fastEconomical',
        order: 10,
      },
      {
        id: 'gpt-4o',
        label: 'GPT-4o',
        descriptionKey: 'integrations.models.balanced',
        order: 20,
      },
      {
        id: 'gpt-4-turbo',
        label: 'GPT-4 Turbo',
        descriptionKey: 'integrations.models.powerful',
        order: 30,
      },
    ],
  },

  mistral: {
    default: 'mistral-small-latest',
    models: [
      {
        id: 'mistral-small-latest',
        label: 'Mistral Small',
        descriptionKey: 'integrations.models.fast',
        order: 10,
      },
      {
        id: 'mistral-medium-latest',
        label: 'Mistral Medium',
        descriptionKey: 'integrations.models.balanced',
        order: 20,
      },
      {
        id: 'mistral-large-latest',
        label: 'Mistral Large',
        descriptionKey: 'integrations.models.powerful',
        order: 30,
      },
    ],
  },

  // Infomaniak's chat API only accepts these short aliases, while its /models
  // endpoint returns full names (e.g. "swiss-ai/Apertus-70B-Instruct-2509").
  // The provider therefore has no usable listing and this list is its only
  // source — the clearest justification for keeping a catalogue at all.
  infomaniak: {
    default: 'mixtral',
    models: [
      {
        id: 'mixtral',
        label: 'Mixtral',
        descriptionKey: 'integrations.models.recommended',
        order: 10,
      },
      { id: 'llama3', label: 'LLaMA 3', order: 20 },
      { id: 'granite', label: 'Granite', order: 30 },
      { id: 'mistral24b', label: 'Mistral 24B', order: 40 },
      { id: 'mistral3', label: 'Mistral 3', order: 50 },
      { id: 'qwen3', label: 'Qwen 3', order: 60 },
      { id: 'gemma3n', label: 'Gemma 3n', order: 70 },
    ],
  },
};

/**
 * Per-provider noise filters applied to a remote listing.
 *
 * Only providers whose listing endpoint mixes model families need one. Where
 * the API exposes usable metadata the provider filters at the source instead
 * (Mistral on `capabilities.completion_chat`), and providers whose model names
 * are chosen by the customer (Azure deployments, self-hosted endpoints) must
 * never be filtered — any guess would be wrong.
 *
 * `exclude` wins over `include`. A model already in the catalogue bypasses
 * both: curation beats pattern matching.
 */
const REMOTE_FILTERS = {
  openai: {
    exclude: [
      /^(text-)?embedding/,
      /^tts-/,
      /^whisper/,
      /^dall-e/,
      /^gpt-image/,
      /moderation/,
      /^davinci/,
      /^babbage/,
      /^sora/,
      /^codex-/,
      /-(audio|realtime|transcribe|tts)(-|$)/,
    ],
    // Positive guard: OpenAI keeps adding model families, and an unknown one
    // is likelier to be noise than a chat model we want to surface silently.
    include: [/^(gpt|o\d|chatgpt)/],
  },
};

const EMPTY_FILTER = { exclude: [], include: [] };

function getCatalogModels(providerKey) {
  const entry = CATALOG[providerKey];
  if (!entry) return [];
  return entry.models
    .map((model) => ({ ...model }))
    .sort((a, b) => a.order - b.order);
}

function getCatalogEntry(providerKey, modelId) {
  const entry = CATALOG[providerKey];
  if (!entry) return null;
  const found = entry.models.find((model) => model.id === modelId);
  return found ? { ...found } : null;
}

function getCatalogDefaultModel(providerKey) {
  const entry = CATALOG[providerKey];
  return (entry && entry.default) || null;
}

function isModelKnown(providerKey, modelId) {
  return getCatalogEntry(providerKey, modelId) !== null;
}

function getRemoteModelFilter(providerKey) {
  return REMOTE_FILTERS[providerKey] || EMPTY_FILTER;
}

/**
 * Whether a model id returned by a provider's listing should be offered.
 * Catalogue entries always pass.
 */
function passesRemoteFilter(providerKey, modelId) {
  if (isModelKnown(providerKey, modelId)) return true;

  const { exclude, include } = getRemoteModelFilter(providerKey);
  if (exclude.some((pattern) => pattern.test(modelId))) return false;
  if (include.length > 0 && !include.some((pattern) => pattern.test(modelId))) {
    return false;
  }
  return true;
}

module.exports = {
  getCatalogModels,
  getCatalogEntry,
  getCatalogDefaultModel,
  isModelKnown,
  getRemoteModelFilter,
  passesRemoteFilter,
};
