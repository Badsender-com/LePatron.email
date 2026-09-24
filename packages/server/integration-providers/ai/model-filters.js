'use strict';

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
  // Gemini's listing reports speech and image models as supporting
  // generateContent, so filtering on that method alone lets them through.
  //
  // It also still advertises the generations closed to new accounts: every
  // gemini-2.5-* id it lists answered 404 "no longer available to new users"
  // when called. Offering them only sets the admin up for a failing call.
  gemini: {
    exclude: [
      /-tts$/,
      /(^|-)image(-|$)/,
      /^imagen/,
      /^veo/,
      /^gemini-(1\.\d|2\.0|2\.5)(-|$)/,
    ],
    include: [],
  },

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

function getRemoteModelFilter(providerKey) {
  return REMOTE_FILTERS[providerKey] || EMPTY_FILTER;
}

/**
 * Whether an id passes this provider's patterns. Knowing nothing about the
 * catalogue is the point: callers decide whether a curated entry short-circuits
 * the patterns.
 */
function matchesRemoteFilter(providerKey, modelId) {
  const { exclude, include } = getRemoteModelFilter(providerKey);
  if (exclude.some((pattern) => pattern.test(modelId))) return false;
  if (include.length > 0 && !include.some((pattern) => pattern.test(modelId))) {
    return false;
  }
  return true;
}

module.exports = { getRemoteModelFilter, matchesRemoteFilter };
