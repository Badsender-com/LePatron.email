'use strict';

const logger = require('../../utils/logger.js');
const { fetchProviderJson } = require('../provider-http.js');
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

  /**
   * Endpoint listing the models, also used as the cheapest credential check.
   * Overridden by the dialects that put it elsewhere.
   */
  _getModelsUrl() {
    return `${this.baseUrl}/v1/models`;
  },

  /**
   * Cheaper and safer than a real completion: it spends no tokens.
   *
   * Shared rather than per provider — every implementation was the same four
   * lines differing only by the name in the log line, which is also what the
   * duplication gate was counting.
   */
  async validateCredentials() {
    try {
      await fetchProviderJson(this._getModelsUrl(), {
        headers: this._buildHeaders(),
        label: 'credentials check',
      });
      return true;
    } catch (error) {
      logger.error(
        `${this.getProviderType()} validation error:`,
        error.message
      );
      return false;
    }
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
    reasoningEffort,
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

    if (reasoningEffort && this._supportsReasoningEffort(model)) {
      body.reasoning_effort = reasoningEffort;
    }

    if (responseFormat && this._supportsResponseFormat()) {
      // Only the type: callers may attach the JSON schema for providers that
      // can enforce it, and OpenAI rejects unknown keys in this object.
      body.response_format = { type: responseFormat.type };
    }

    return body;
  },

  /**
   * Read a provider response into the shape every caller here expects.
   *
   * @returns {{ content: string, usage: { promptTokens, completionTokens, totalTokens, cachedTokens } }}
   */
  // eslint-disable-next-line no-unused-vars
  _parseResponse(data, requestBody) {
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

  _getFinishReason(data) {
    const choice = (data.choices || [])[0];
    return choice && choice.finish_reason === 'length' ? 'length' : null;
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

  /**
   * Whether the model takes a reasoning effort. Only reasoning models do, and
   * the others reject the parameter.
   */
  _supportsReasoningEffort() {
    return false;
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
