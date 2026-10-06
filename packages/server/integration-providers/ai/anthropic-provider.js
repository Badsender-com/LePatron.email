'use strict';

const BaseLLMProvider = require('./base-llm-provider');
const { fetchProviderJson } = require('../provider-http.js');
const { splitSystemMessages } = require('./message-utils.js');
const logger = require('../../utils/logger.js');
const {
  JSON_TOOL_NAME,
  buildJsonModeFields,
  detectJsonModeQuirk,
  applyAnthropicQuirks,
  requestedSchema,
  unwrapEnvelope,
} = require('./anthropic-json-mode.js');
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
// Generation 5 dropped the temperature parameter and answers 400 when it is
// sent; 3.x and 4.x still take it. Verified against a live account.
//
// An allow list of the generations known to take it, not a deny list of those
// known to refuse it: translation always sends one, so under a deny list the
// first new generation typed in failed every call, as 5 did. Now it just runs
// at its own default. Both id styles are matched on the family digit —
// `claude-3-5-sonnet-…` and `claude-haiku-4-5-…` — so the 5 in either is not
// mistaken for generation 5.
const TEMPERATURE_MODELS = /^claude-(3|[a-z]+-[34])(-|$)/;

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

  // Claimed through structured outputs or a tool call (anthropic-json-mode.js)
  // rather than a response_format flag. Without it the model is free to
  // answer in prose — which it does: a skill whose prompt asked for "du texte
  // simple" got prose back and failed at OUTPUT_PARSE, because the injected
  // JSON contract and the skill's own wording pull in opposite directions and
  // nothing settled the conflict.
  supportsJsonResponseFormat() {
    return true;
  }

  _supportsResponseFormat() {
    return false;
  }

  _getMaxTokens() {
    return DEFAULT_MAX_TOKENS;
  }

  _supportsTemperature(model) {
    return TEMPERATURE_MODELS.test(model || '');
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

  _buildRequestBody({
    model,
    messages,
    temperature,
    maxTokens,
    responseFormat,
  }) {
    const { system, conversation } = splitSystemMessages(messages);

    const body = {
      model,
      messages: conversation,
      max_tokens: maxTokens || this._getMaxTokens(),
    };
    if (system) body.system = system;
    if (temperature !== undefined && this._supportsTemperature(model)) {
      body.temperature = temperature;
    }

    // response_format does not exist on this endpoint, and prefilling an
    // assistant turn with `{` is refused by generation 5 ("does not support
    // assistant message prefill"): both were tried against a live account.
    if (responseFormat && responseFormat.type === 'json_object') {
      Object.assign(body, buildJsonModeFields(responseFormat.schema));
    }

    return body;
  }

  _parseResponse(data, requestBody) {
    // The model declining is not a technical failure, and reporting it as an
    // empty response sent us looking for a parser bug. Gemini's equivalent
    // (finishReason SAFETY) was already named; this one was not.
    if (data.stop_reason === 'refusal') {
      throw new ProviderError(
        'Anthropic declined to answer this prompt',
        CODES.INVALID_RESPONSE
      );
    }

    if (!Array.isArray(data.content)) {
      throw new ProviderError(
        'Invalid response structure from anthropic',
        CODES.INVALID_RESPONSE
      );
    }

    const content = this._readContent(data, requestBody);

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

  /**
   * Filtered on type: a response can also carry thinking or tool-use blocks,
   * and concatenating those would put reasoning into the output.
   * A tool call comes back already parsed, so it is re-serialised rather
   * than read as text: the callers expect a JSON string, and this way nothing
   * has to survive a round trip through prose.
   */
  _readContent(data, requestBody) {
    const toolUse = data.content.find(
      (block) => block.type === 'tool_use' && block.name === JSON_TOOL_NAME
    );
    const text = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const schema = requestedSchema(requestBody);
    if (!schema) return toolUse ? JSON.stringify(toolUse.input) : text;

    let answer = toolUse && toolUse.input;
    if (!answer) {
      // Text that is not plain JSON is left to the caller's repair pass.
      try {
        answer = JSON.parse(text);
      } catch {
        return text;
      }
    }
    // Here rather than per feature: every skill reads through this method.
    const { value, envelope } = unwrapEnvelope(answer, schema);
    if (envelope) {
      logger.warn(
        `anthropic/${data.model}: unwrapped an answer nested under "${envelope}"`
      );
    }
    return toolUse || envelope ? JSON.stringify(value) : text;
  }

  _getFinishReason(data) {
    return data.stop_reason === 'max_tokens' ? 'length' : null;
  }

  /**
   * Only the JSON-mode routes are adapted, on Anthropic's own wordings
   * (anthropic-json-mode.js). The OpenAI detection inherited from the dialect
   * would match nothing here — by luck of the wording, not by design.
   */
  _detectParamQuirk(status, parsedError, message) {
    return detectJsonModeQuirk(status, parsedError, message);
  }

  _applyParamQuirks(body, quirks) {
    return applyAnthropicQuirks(body, quirks);
  }

  _mapErrorToCode(status) {
    // 403 is Anthropic's permission_error, which in practice means the key is
    // not valid for this call — closer to invalid credentials than to a
    // generic API error, and far more actionable for the admin.
    if (status === 401 || status === 403) return CODES.INVALID_CREDENTIALS;
    if (status === 429) return CODES.QUOTA_EXCEEDED;
    return CODES.API_ERROR;
  }

  /** Anthropic lists chat models only, with a display name — no filtering needed. */
  async listRemoteModels() {
    const payload = await fetchProviderJson(
      `${this.baseUrl}/v1/models?limit=1000`,
      {
        headers: this._buildHeaders(),
        label: 'Anthropic models listing',
        mapErrorToCode: (status) => this._mapErrorToCode(status),
      }
    );

    return (payload.data || []).map((model) => ({
      id: model.id,
      label: model.display_name || model.id,
    }));
  }

  /**
   * Claude tends to open with a sentence before the JSON. The base prompt asks
   * for JSON only; this makes the first character explicit, which is what the
   * parser actually depends on.
   */
  _getSystemPrompt() {
    return 'You are a JSON translation API. You receive a JSON object and return the same JSON object with translated values. Return valid JSON only: no preamble, no explanation, no markdown fences. The first character of your reply must be {.';
  }

  /**
   * Sized on the 8192-token output ceiling, which a mailing's HTML-heavy
   * texts fill at about 2.3 characters a token: a 30 000-character batch
   * answered 19 174 characters and was cut. 12 000, keys included, leaves room
   * for a target language that runs longer than the source; a batch that still
   * overflows is split rather than failed.
   */
  getBatchLimits() {
    return { maxKeys: 80, maxChars: 12000 };
  }
}

module.exports = AnthropicProvider;
