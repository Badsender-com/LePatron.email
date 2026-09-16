'use strict';

const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const BaseLLMProvider = require('./base-llm-provider');
const logger = require('../../utils/logger.js');
const { assertOutboundHostAllowed } = require('../../utils/outbound-host.js');
const { splitSystemMessages } = require('./message-utils.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../provider-error.js');

const DEFAULT_API_HOST = 'https://api.anthropic.com';
// Pinned: Anthropic versions its API by date and an older pin keeps working,
// where "latest" would move the contract under us without warning.
const API_VERSION = '2023-06-01';
// Anthropic requires max_tokens on every request — there is no "model
// default" to fall back on, so this is a real ceiling rather than a guard.
const DEFAULT_MAX_TOKENS = 8192;
const MODELS_TIMEOUT_MS = 5000;

/**
 * Anthropic (Claude), on the Messages API.
 *
 * Four things differ from the OpenAI dialect, and each is a hook below:
 * authentication headers, the system prompt sitting outside the conversation,
 * a response made of content blocks, and its own token counter names.
 */
class AnthropicProvider extends BaseLLMProvider {
  constructor(integration) {
    super(integration);
    this.baseUrl = this.apiHost || DEFAULT_API_HOST;
  }

  // No native JSON mode: the repair pass in skill-invocation stays the
  // defence, which is exactly what it was written for.
  supportsJsonResponseFormat() {
    return false;
  }

  _supportsResponseFormat() {
    return false;
  }

  _getMaxTokens() {
    return DEFAULT_MAX_TOKENS;
  }

  _getEndpointUrl() {
    return `${this.baseUrl}/v1/messages`;
  }

  _buildHeaders() {
    return {
      'Content-Type': 'application/json',
      // Not a Bearer token: Anthropic answers 401 without a usable message
      // when the wrong scheme is used.
      'x-api-key': this.apiKey,
      'anthropic-version': API_VERSION,
    };
  }

  _buildRequestBody({ model, messages, temperature, maxTokens }) {
    const { system, conversation } = splitSystemMessages(messages);

    const body = {
      model,
      messages: conversation,
      max_tokens: maxTokens || this._getMaxTokens(),
    };
    if (system) body.system = system;
    if (temperature !== undefined) body.temperature = temperature;

    return body;
  }

  _parseResponse(data) {
    if (!Array.isArray(data.content)) {
      throw new ProviderError(
        'Invalid response structure from anthropic',
        CODES.INVALID_RESPONSE
      );
    }

    // Filtered on type: a response can also carry thinking or tool-use blocks,
    // and concatenating those would put reasoning into the output.
    const content = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Truncation guarantees malformed JSON downstream, so it is worth a line
    // in the log rather than surfacing as an unexplained parse failure.
    if (data.stop_reason === 'max_tokens') {
      logger.error(
        'anthropic response hit max_tokens — output is truncated',
        `model: ${data.model}`
      );
    }

    const usage = data.usage || {};
    const promptTokens = usage.input_tokens || 0;
    const completionTokens = usage.output_tokens || 0;
    return {
      content,
      usage: {
        promptTokens,
        completionTokens,
        // Anthropic reports no total; the callers persist one.
        totalTokens: promptTokens + completionTokens,
        cachedTokens: usage.cache_read_input_tokens || 0,
      },
    };
  }

  _mapErrorToCode(status) {
    // 403 is Anthropic's permission_error, which in practice means the key is
    // not valid for this call — closer to invalid credentials than to a
    // generic API error, and far more actionable for the admin.
    if (status === 401 || status === 403) return CODES.INVALID_CREDENTIALS;
    if (status === 429) return CODES.QUOTA_EXCEEDED;
    return CODES.API_ERROR;
  }

  /**
   * Cheaper and safer than a real completion: lists models without spending
   * tokens.
   */
  async validateCredentials() {
    try {
      await assertOutboundHostAllowed(this.baseUrl);
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: this._buildHeaders(),
      });
      return response.ok;
    } catch (error) {
      logger.error('Anthropic validation error:', error.message);
      return false;
    }
  }

  /** Anthropic lists chat models only, with a display name — no filtering needed. */
  async listRemoteModels() {
    await assertOutboundHostAllowed(this.baseUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MODELS_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: this._buildHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ProviderError(
          `Anthropic models listing failed: ${response.status}`,
          this._mapErrorToCode(response.status)
        );
      }

      const payload = await response.json();
      return (payload.data || []).map((model) => ({
        id: model.id,
        label: model.display_name || model.id,
      }));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Claude tends to open with a sentence before the JSON. The base prompt asks
   * for JSON only; this makes the first character explicit, which is what the
   * parser actually depends on.
   */
  _getSystemPrompt() {
    return 'You are a JSON translation API. You receive a JSON object and return the same JSON object with translated values. Return valid JSON only: no preamble, no explanation, no markdown fences. The first character of your reply must be {.';
  }

  /** Lower than the OpenAI default, in step with the 8192-token output ceiling. */
  getBatchLimits() {
    return { maxKeys: 80, maxChars: 30000 };
  }
}

module.exports = AnthropicProvider;
