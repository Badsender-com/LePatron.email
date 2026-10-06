'use strict';

const AIProviderInterface = require('./ai-provider.interface');
const { translationMethods } = require('./llm-translation.js');
const { openAIDialect } = require('./openai-dialect.js');
const { chatCallMethods } = require('./chat-call.js');
const {
  getCatalogModels,
  getCatalogDefaultModel,
} = require('./model-catalog.js');

/**
 * Base class for LLM providers. The behaviour comes from three mixins applied
 * at the bottom of this file: the translation path (llm-translation.js), the
 * guarded call and its parameter adaptation (chat-call.js), and the OpenAI
 * dialect as the default request shaping (openai-dialect.js), whose hooks
 * Anthropic and Gemini override where they differ.
 *
 * Subclasses set `this.baseUrl`. Curated models and defaults come from
 * model-catalog.js; `listRemoteModels()` asks the provider itself.
 */
class BaseLLMProvider extends AIProviderInterface {
  /**
   * Get provider capabilities for the frontend.
   * LLM providers support model selection; they do not support formality.
   */
  getCapabilities() {
    return {
      supportsModelSelection: true,
      supportsFormality: false,
    };
  }

  /**
   * Curated models for this provider, from the central catalogue.
   *
   * Used as the fallback when the remote listing fails, and as the only
   * source for providers that have no usable one (see model-catalog.js).
   * Subclasses no longer carry their own list.
   */
  getStaticModels() {
    return getCatalogModels(this.getProviderType());
  }

  /**
   * Models the provider itself reports, or `null` when it offers no usable
   * listing — which is different from `[]`, "the account has no model".
   *
   * Implementations are expected to throw on a network or auth failure: the
   * listing service catches it and falls back to the catalogue, so a provider
   * being unreachable must not read as "this account has no models".
   *
   * @returns {Promise<Array<{ id: string, label?: string }>|null>}
   */
  async listRemoteModels() {
    return null;
  }

  /**
   * Get the model to use for translation.
   * Reads from integration config first, falls back to the provider default.
   */
  getDefaultTranslationModel() {
    return this.config.model || this._getDefaultModel();
  }

  // ─── hooks ────────────────────────────────────────────────────────────────

  /**
   * Why the model stopped, normalised to `'length'` when it ran out of output
   * budget. Dialects name this differently; the base class only needs to tell
   * truncation from a normal stop.
   *
   * @returns {string|null}
   */
  // eslint-disable-next-line no-unused-vars
  _getFinishReason(data) {
    return null;
  }

  /**
   * The model used when the group configured none.
   *
   * Reads the catalogue rather than a per-class constant. Stays synchronous:
   * `chatComplete` and `getDefaultTranslationModel` both call it inline.
   * Subclasses whose model is not a catalogue entry (a customer-chosen Azure
   * deployment, say) override this.
   */
  _getDefaultModel() {
    const fromCatalog = getCatalogDefaultModel(this.getProviderType());
    if (fromCatalog) return fromCatalog;
    throw new Error('_getDefaultModel() must be implemented by subclass');
  }

  /**
   * Whether the provider's chat API guarantees syntactically valid JSON when
   * passed `response_format: { type: 'json_object' }`. Conservative default:
   * false — providers known to support it override to true. Used by the skill
   * invocation service to harden structured outputs (LLMs hand-writing JSON
   * produce raw newlines / unescaped quotes inside long strings).
   */
  supportsJsonResponseFormat() {
    return false;
  }

  // ─── public chat completion ───────────────────────────────────────────────

  /**
   * Public chat-completion entry point used by the LePatron Skills IA module.
   *
   * Returns the content and token usage so callers can log invocations, and
   * whether the answer was cut at the output token ceiling.
   *
   * @param {Object} params
   * @param {string} [params.model] — defaults to provider's default model
   * @param {Array<{role: string, content: string}>} params.messages
   * @param {number} [params.temperature]
   * @param {number} [params.maxTokens]
   * @param {Object} [params.responseFormat]
   * @returns {Promise<{ content: string, usage: { promptTokens: number, completionTokens: number, totalTokens: number, cachedTokens: number }, truncated: boolean }>}
   */
  async chatComplete({
    model,
    messages,
    temperature,
    maxTokens,
    responseFormat,
  }) {
    return this._callChatCompletionRaw({
      model: model || this._getDefaultModel(),
      messages,
      temperature,
      maxTokens,
      responseFormat,
    });
  }
}

// Translation lives in its own module; applied here so subclasses keep
// overriding `_buildTranslationPrompt` / `_getSystemPrompt` as before.
//
// The OpenAI dialect is applied the same way, as the default request shaping
// and response reading. Providers speaking it inherit these untouched;
// Anthropic and Gemini override the handful that differ.
Object.assign(
  BaseLLMProvider.prototype,
  translationMethods,
  chatCallMethods,
  openAIDialect
);

module.exports = BaseLLMProvider;
