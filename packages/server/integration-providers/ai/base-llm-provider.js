'use strict';

const AIProviderInterface = require('./ai-provider.interface');
const logger = require('../../utils/logger.js');
const { guardedFetch, toProviderError } = require('../provider-http.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../provider-error.js');
const { translationMethods } = require('./llm-translation.js');
const { readProviderError } = require('./provider-error-body.js');
const { openAIDialect } = require('./openai-dialect.js');
const {
  getCatalogModels,
  getCatalogDefaultModel,
} = require('./model-catalog.js');

/**
 * Base class for LLM providers. It keeps what must never be duplicated per
 * provider — the guarded call, its bounds, error masking and typing — and
 * takes the rest from two mixins applied at the bottom of this file: the
 * translation behaviour (llm-translation.js), and the OpenAI dialect as the
 * default request shaping (openai-dialect.js), whose hooks Anthropic and
 * Gemini override where they differ.
 *
 * Subclasses set `this.baseUrl`. Curated models and defaults come from
 * model-catalog.js; `listRemoteModels()` asks the provider itself.
 */
// A whole mailing translates in batches of this, and reasoning models take
// their time: generous, but no longer unbounded while the body is read.
const CHAT_TIMEOUT_MS = 5 * 60 * 1000;
// A translation batch answers in well under a megabyte.
const CHAT_MAX_BYTES = 10 * 1024 * 1024;

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
   * Unlike _callChatCompletion (which returns only the content string), this
   * returns both the content and token usage so callers can log invocations.
   *
   * @param {Object} params
   * @param {string} [params.model] — defaults to provider's default model
   * @param {Array<{role: string, content: string}>} params.messages
   * @param {number} [params.temperature]
   * @param {number} [params.maxTokens]
   * @param {Object} [params.responseFormat]
   * @returns {Promise<{ content: string, usage: { promptTokens: number, completionTokens: number, totalTokens: number, cachedTokens: number } }>}
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

  // ─── API call ─────────────────────────────────────────────────────────────

  // Legacy translation code path: content string only.
  async _callChatCompletion({
    model,
    messages,
    temperature,
    responseFormat,
    reasoningEffort,
  }) {
    const { content } = await this._callChatCompletionRaw({
      model,
      messages,
      temperature,
      responseFormat,
      reasoningEffort,
    });
    return content;
  }

  /**
   * Performs the call and returns the normalized `{ content, usage }` its
   * dialect produced — never the raw payload, so callers stay independent of
   * which provider answered.
   *
   * Everything that must not be duplicated per provider lives here: the SSRF
   * re-check immediately before the request, the timeout, the log sanitising
   * that masks keys, and the mapping onto our error vocabulary. A dialect
   * changes what is sent and how the answer is read, never this.
   */
  async _callChatCompletionRaw({
    model,
    messages,
    temperature,
    maxTokens,
    responseFormat,
    reasoningEffort,
  }) {
    const providerName = this.getProviderType();
    logger.log(
      `Calling ${providerName} API with model:`,
      model,
      'at',
      this.baseUrl
    );

    const startTime = Date.now();

    try {
      const requestBody = this._buildRequestBody({
        model,
        messages,
        temperature,
        maxTokens,
        responseFormat,
        reasoningEffort,
      });

      // The timeout is node-fetch's own, not an AbortController cleared once
      // the headers are in: it also bounds the body read, which is where a
      // slow endpoint would otherwise hold the request forever.
      const response = await guardedFetch(this._getEndpointUrl(model), {
        method: 'POST',
        headers: this._buildHeaders(),
        body: JSON.stringify(requestBody),
        timeoutMs: CHAT_TIMEOUT_MS,
        maxBytes: CHAT_MAX_BYTES,
        label: `${providerName} API`,
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (!response.ok) {
        // Sanitised, not raw: this message is persisted on skill invocations
        // and shown to the user, not only logged.
        const { parsedError, message } = await readProviderError(response);
        logger.error(`${providerName} API error:`, response.status, message);
        throw new ProviderError(
          `${providerName} API error: ${response.status} - ${message}`,
          this._mapErrorToCode(response.status, parsedError)
        );
      }

      const data = await response.json();
      // The request is handed over too: a dialect may have shaped it in a way
      // that changes how the answer must be read.
      const result = this._parseResponse(data, requestBody);

      // Truncation guarantees malformed JSON downstream, and the only trace
      // otherwise is a parse error blaming the model. Checked here rather than
      // per dialect: three dialects had three behaviours, and the one serving
      // six providers silently did nothing.
      if (this._getFinishReason(data) === 'length') {
        logger.error(
          `${providerName} response was truncated (output token limit reached)`,
          `model: ${model}`
        );
      }

      // Content length stays in the log: a response that arrives empty is
      // otherwise indistinguishable from a normal one here.
      logger.log(
        `${providerName} response received in ${elapsed}s - length: ${
          result.content ? result.content.length : 0
        } chars, tokens: ${result.usage.totalTokens || 'N/A'}`
      );

      return result;
    } catch (caught) {
      // Body reads fail as raw FetchErrors (size, timeout): typed like the
      // request itself, with no address in the message.
      const error =
        caught && caught.name === 'FetchError'
          ? toProviderError(caught, `${providerName} API`)
          : caught;
      if (error.code === CODES.TIMEOUT) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.error(
          `${providerName} API timeout after ${elapsed}s (limit: ${
            CHAT_TIMEOUT_MS / 1000
          }s)`
        );
        throw new ProviderError(
          `${providerName} API timeout - the request took too long.`,
          CODES.TIMEOUT
        );
      }
      throw error;
    }
  }
}

// Translation lives in its own module; applied here so subclasses keep
// overriding `_buildTranslationPrompt` / `_getSystemPrompt` as before.
//
// The OpenAI dialect is applied the same way, as the default request shaping
// and response reading. Providers speaking it inherit these untouched;
// Anthropic and Gemini override the handful that differ.
Object.assign(BaseLLMProvider.prototype, translationMethods, openAIDialect);

module.exports = BaseLLMProvider;
