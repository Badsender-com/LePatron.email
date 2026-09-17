'use strict';

const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const AIProviderInterface = require('./ai-provider.interface');
const logger = require('../../utils/logger.js');
const { assertOutboundHostAllowed } = require('../../utils/outbound-host.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../provider-error.js');
const { translationMethods } = require('./llm-translation.js');
const { openAIDialect } = require('./openai-dialect.js');
const {
  getCatalogModels,
  getCatalogDefaultModel,
} = require('./model-catalog.js');

/**
 * Base class for LLM-based AI providers (OpenAI, Mistral, Infomaniak, etc.)
 * All three share the same OpenAI-compatible chat completions API contract.
 *
 * Subclasses must implement:
 *   - constructor: set this.baseUrl
 *   - validateCredentials()
 *   - _getDefaultModel() → string
 *
 * Subclasses may override:
 *   - _getChatCompletionsUrl() — for providers with non-standard endpoint paths
 *   - _supportsResponseFormat() → bool  — false for providers that ignore response_format
 *   - _getMaxTokens() → number          — provider token limit
 *   - _buildTranslationPrompt()         — for provider-specific prompt tuning
 *   - _getSystemPrompt()                — for provider-specific system prompt
 *   - listRemoteModels()                — live model listing from the provider
 *
 * Curated model lists and defaults come from model-catalog.js, not from the
 * subclasses.
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
   * Sanitize log messages to prevent leaking sensitive data (API keys, tokens).
   * Truncates long messages and masks potential secrets.
   */
  _sanitizeLogMessage(message) {
    if (!message) return 'Unknown error';
    const str = String(message);
    // Truncate to 300 chars max
    const truncated = str.length > 300 ? str.substring(0, 300) + '...' : str;
    // Mask potential API keys/tokens (long alphanumeric strings)
    return truncated.replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[REDACTED]');
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
  async _callChatCompletion({ model, messages, temperature, responseFormat }) {
    const { content } = await this._callChatCompletionRaw({
      model,
      messages,
      temperature,
      responseFormat,
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
  }) {
    const providerName = this.getProviderType();
    logger.log(
      `Calling ${providerName} API with model:`,
      model,
      'at',
      this.baseUrl
    );

    const TIMEOUT_MS = 300000; // 5 minutes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const startTime = Date.now();

    try {
      // SSRF guard at call time (TOCTOU): re-validate the host right before the
      // outbound request, in case DNS changed since the integration was saved.
      await assertOutboundHostAllowed(this.baseUrl);

      const requestBody = this._buildRequestBody({
        model,
        messages,
        temperature,
        maxTokens,
        responseFormat,
      });

      const response = await fetch(this._getEndpointUrl(model), {
        method: 'POST',
        headers: this._buildHeaders(),
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMessage = 'Unknown error';
        let parsedError = null;
        try {
          parsedError = JSON.parse(errorText);
          errorMessage =
            (parsedError.error && parsedError.error.message) ||
            parsedError.message ||
            (parsedError.result && parsedError.result.message) ||
            'Unknown error';
        } catch {
          errorMessage = errorText || 'Unknown error';
        }
        // Sanitize error message to prevent logging sensitive data
        const sanitizedMessage = this._sanitizeLogMessage(errorMessage);
        logger.error(
          `${providerName} API error:`,
          response.status,
          sanitizedMessage
        );
        throw new ProviderError(
          `${providerName} API error: ${response.status} - ${errorMessage}`,
          this._mapErrorToCode(response.status, parsedError)
        );
      }

      const data = await response.json();
      // The request is handed over too: a dialect may have shaped it in a way
      // that changes how the answer must be read (Anthropic prefills).
      const result = this._parseResponse(data, requestBody);

      // Content length stays in the log: a response that arrives empty is
      // otherwise indistinguishable from a normal one here.
      logger.log(
        `${providerName} response received in ${elapsed}s - length: ${
          result.content ? result.content.length : 0
        } chars, tokens: ${result.usage.totalTokens || 'N/A'}`
      );

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (error.name === 'AbortError') {
        logger.error(
          `${providerName} API timeout after ${elapsed}s (limit: ${
            TIMEOUT_MS / 1000
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
