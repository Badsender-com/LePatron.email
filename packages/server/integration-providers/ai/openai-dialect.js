'use strict';

const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../provider-error.js');

/**
 * The OpenAI chat-completions dialect: how a request is shaped and how a
 * response is read.
 *
 * These are the default implementations of the base class hooks, kept here
 * rather than inline so that the base class is left with the parts that must
 * never be duplicated — SSRF guard, timeout, log sanitising, error typing —
 * and so that a provider speaking another dialect has a worked example to
 * follow rather than a method body to copy.
 *
 * Providers on this dialect (OpenAI, Mistral, Infomaniak, Azure, and the
 * OpenAI-compatible endpoints) inherit these untouched, or override the one
 * piece that differs.
 */
const openAIDialect = {
  /** URL for the chat completions endpoint. Override for non-standard paths. */
  _getChatCompletionsUrl() {
    return `${this.baseUrl}/v1/chat/completions`;
  },

  /**
   * Endpoint for a given model. Takes the model because some dialects put it
   * in the path rather than the body (Gemini does).
   */
  // eslint-disable-next-line no-unused-vars
  _getEndpointUrl(model) {
    return this._getChatCompletionsUrl();
  },

  _buildHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  },

  _buildRequestBody({
    model,
    messages,
    temperature,
    maxTokens,
    responseFormat,
  }) {
    const body = {
      model,
      messages,
      [this._maxTokensParamName(model)]: maxTokens || this._getMaxTokens(),
    };

    // Omitted rather than defaulted: a model that rejects an explicit
    // temperature rejects the request outright, and its own default is the
    // only value it will run at.
    if (temperature !== undefined && this._supportsTemperature(model)) {
      body.temperature = temperature;
    }

    if (responseFormat && this._supportsResponseFormat()) {
      body.response_format = responseFormat;
    }

    return body;
  },

  /**
   * Read a provider response into the shape every caller here expects.
   *
   * @returns {{ content: string, usage: { promptTokens, completionTokens, totalTokens, cachedTokens } }}
   */
  _parseResponse(data) {
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new ProviderError(
        `Invalid response structure from ${this.getProviderType()}`,
        CODES.INVALID_RESPONSE
      );
    }

    const usage = data.usage || {};
    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
        cachedTokens:
          (usage.prompt_tokens_details &&
            usage.prompt_tokens_details.cached_tokens) ||
          0,
      },
    };
  },

  /**
   * Map an HTTP status onto our own error vocabulary. Dialects differ on which
   * status means what — Google answers 400 for an invalid key, Anthropic 403 —
   * so this is a hook rather than a shared table.
   */
  // eslint-disable-next-line no-unused-vars
  _mapErrorToCode(status, errorData) {
    if (status === 401) return CODES.INVALID_CREDENTIALS;
    if (status === 429) return CODES.QUOTA_EXCEEDED;
    return CODES.API_ERROR;
  },

  /** Name of the output-length parameter for this model. */
  _maxTokensParamName() {
    return 'max_tokens';
  },

  /** Whether the model accepts an explicit temperature. */
  _supportsTemperature() {
    return true;
  },

  /** Whether the provider accepts the response_format parameter. */
  _supportsResponseFormat() {
    return true;
  },

  /** Maximum tokens to request. */
  _getMaxTokens() {
    return 16000;
  },
};

module.exports = { openAIDialect };
