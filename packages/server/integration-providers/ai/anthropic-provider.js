'use strict';

const BaseLLMProvider = require('./base-llm-provider');
const { fetchProviderJson } = require('../provider-http.js');
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
const JSON_TOOL_NAME = 'emit_json';

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

  // Claimed through the forced tool call below rather than a response_format
  // flag. Without it the model is free to answer in prose — which it does: a
  // skill whose prompt asked for "du texte simple" got prose back and failed
  // at OUTPUT_PARSE, because the injected JSON contract and the skill's own
  // wording pull in opposite directions and nothing settled the conflict.
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

    // Forcing a tool call is what actually holds the format here. Two other
    // routes were tried against a live account and rejected by the API:
    // response_format does not exist on this endpoint, and prefilling an
    // assistant turn with `{` is refused outright by generation 5 ("does not
    // support assistant message prefill"). A forced tool works on both
    // generations, and hands back a parsed object rather than text to repair.
    //
    if (responseFormat && responseFormat.type === 'json_object') {
      body.tools = [
        {
          name: JSON_TOOL_NAME,
          description: 'Emit the JSON object required by the output contract.',
          // The real schema when the caller supplies one. Left open, the
          // model invents a shape: observed live, one answer came back
          // wrapped in `parameters`, another nested `text` inside `text`.
          // Anthropic requires an object at the top: any other shape would
          // be a 400 on every call, so it falls back to the open object.
          input_schema:
            responseFormat.schema && responseFormat.schema.type === 'object'
              ? responseFormat.schema
              : { type: 'object' },
        },
      ];
      body.tool_choice = { type: 'tool', name: JSON_TOOL_NAME };
    }

    return body;
  }

  // eslint-disable-next-line no-unused-vars
  _parseResponse(data, requestBody) {
    if (!Array.isArray(data.content)) {
      throw new ProviderError(
        'Invalid response structure from anthropic',
        CODES.INVALID_RESPONSE
      );
    }

    // Filtered on type: a response can also carry thinking or tool-use blocks,
    // and concatenating those would put reasoning into the output.
    // A forced tool call comes back already parsed, so it is re-serialised
    // rather than read as text: the callers expect a JSON string, and this
    // way nothing has to survive a round trip through prose.
    const toolUse = data.content.find(
      (block) => block.type === 'tool_use' && block.name === JSON_TOOL_NAME
    );
    const content = toolUse
      ? JSON.stringify(toolUse.input)
      : data.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('');

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

  _getFinishReason(data) {
    return data.stop_reason === 'max_tokens' ? 'length' : null;
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

  /** Lower than the OpenAI default, in step with the 8192-token output ceiling. */
  getBatchLimits() {
    return { maxKeys: 80, maxChars: 30000 };
  }
}

module.exports = AnthropicProvider;
