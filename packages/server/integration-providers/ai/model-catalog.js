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
    // OpenAI has no self-updating alias the way Mistral has `-latest`, so this
    // name pins a generation and has to be moved deliberately.
    //
    // gpt-5-mini is a reasoning model: it spends tokens thinking before it
    // answers. Measured against a live account on a translation batch, it runs
    // about twice as slow as gpt-4.1-mini (8.9s vs 4.2s for 20 blocks, so
    // roughly 45s vs 21s for the 100-block batch getBatchLimits allows), for
    // the same output. The trade is deliberate — better reasoning on the
    // skills side, at a cost on bulk translation. Worth revisiting if the
    // 30s skill invocation timeout starts being hit.
    default: 'gpt-5-mini',
    models: [
      {
        id: 'gpt-5-mini',
        label: 'GPT-5 Mini',
        descriptionKey: 'integrations.models.fastEconomical',
        order: 10,
      },
      {
        id: 'gpt-5',
        label: 'GPT-5',
        descriptionKey: 'integrations.models.powerful',
        order: 20,
      },
      {
        id: 'gpt-4.1-mini',
        label: 'GPT-4.1 Mini',
        descriptionKey: 'integrations.models.fast',
        order: 30,
      },
      {
        id: 'gpt-4.1',
        label: 'GPT-4.1',
        descriptionKey: 'integrations.models.balanced',
        order: 40,
      },
      // Kept although superseded: groups that picked them explicitly still run
      // on them, and dropping an entry only removes its curated label.
      {
        id: 'gpt-4o-mini',
        label: 'GPT-4o Mini',
        descriptionKey: 'integrations.models.fastEconomical',
        order: 50,
      },
      {
        id: 'gpt-4o',
        label: 'GPT-4o',
        descriptionKey: 'integrations.models.balanced',
        order: 60,
      },
      {
        id: 'gpt-4-turbo',
        label: 'GPT-4 Turbo',
        deprecated: true,
        order: 70,
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
  // Anthropic lists its chat models cleanly, with display names, so the
  // catalogue here is thin on purpose: it exists to name a default and to
  // qualify the main tiers. The listing is what keeps it current.
  //
  // TODO(verify): no Anthropic account was available while writing this.
  // Confirm these ids and the default against a real key before announcing
  // the connector — the listing endpoint answers without spending tokens.
  anthropic: {
    default: 'claude-haiku-4-5-20251001',
    models: [
      {
        id: 'claude-haiku-4-5-20251001',
        label: 'Claude Haiku 4.5',
        descriptionKey: 'integrations.models.fastEconomical',
        order: 10,
      },
      {
        id: 'claude-sonnet-5',
        label: 'Claude Sonnet 5',
        descriptionKey: 'integrations.models.balanced',
        order: 20,
      },
      {
        id: 'claude-opus-5',
        label: 'Claude Opus 5',
        descriptionKey: 'integrations.models.powerful',
        order: 30,
      },
    ],
  },

  // Gemini's listing carries both a display name and a written description,
  // and is filtered at the source on generateContent support, so this only
  // needs to name a default.
  //
  // TODO(verify): same as Anthropic — no Google account was available.
  gemini: {
    default: 'gemini-2.5-flash',
    models: [
      {
        id: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        descriptionKey: 'integrations.models.fastEconomical',
        order: 10,
      },
      {
        id: 'gemini-2.5-pro',
        label: 'Gemini 2.5 Pro',
        descriptionKey: 'integrations.models.powerful',
        order: 20,
      },
    ],
  },

  infomaniak: {
    // Verified against a live account: of the seven aliases this list used to
    // carry, only these three are still accepted — `mixtral`, `llama3`,
    // `granite` and `gemma3n` now answer 422. `mixtral` was the default, so
    // every group that had not picked a model was calling a dead one.
    //
    // Their /models endpoint is no help here: it advertises full names
    // (mistralai/Mistral-Small-4-119B-2603) that the chat API itself rejects,
    // which is why this provider has no remote listing and relies on the list
    // below. Worth re-testing when Infomaniak rotates its line-up again.
    default: 'mistral3',
    models: [
      {
        id: 'mistral3',
        label: 'Mistral 3',
        descriptionKey: 'integrations.models.recommended',
        order: 10,
      },
      { id: 'mistral24b', label: 'Mistral 24B', order: 20 },
      { id: 'qwen3', label: 'Qwen 3', order: 30 },
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
      // Covers gpt-image-* and chatgpt-image-*, which the positive guard below
      // would otherwise wave through on its "chatgpt" prefix.
      /(^|-)image(-|$)/,
      /moderation/,
      /^davinci/,
      /^babbage/,
      /^sora/,
      /^codex-/,
      /-(audio|realtime|transcribe|tts)(-|$)/,
      // Completion models, not chat ones: they answer on /completions and
      // reject the messages payload every caller here sends.
      /-instruct(-|$)/,
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
