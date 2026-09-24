'use strict';

const BaseLLMProvider = require('./base-llm-provider');
const { fetchProviderJson } = require('../provider-http.js');
const { splitSystemMessages } = require('./message-utils.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../provider-error.js');

const DEFAULT_API_HOST = 'https://generativelanguage.googleapis.com';
const API_VERSION = 'v1beta';
/**
 * Google Gemini, on generateContent.
 *
 * The furthest from the OpenAI dialect: the model goes in the URL rather than
 * the body, the conversation uses `contents` with `parts`, the assistant role
 * is called `model`, and the generation settings live in their own object.
 */
class GeminiProvider extends BaseLLMProvider {
  constructor(integration) {
    super(integration);
    this.baseUrl = this.apiHost || DEFAULT_API_HOST;
  }

  // responseMimeType is a real JSON guarantee, same class as OpenAI's JSON
  // mode, so structured outputs can rely on it.
  supportsJsonResponseFormat() {
    return true;
  }

  /**
   * The model is part of the path here, which is why the base class passes it
   * to this hook at all.
   */
  _getEndpointUrl(model) {
    return `${this.baseUrl}/${API_VERSION}/models/${encodeURIComponent(
      model
    )}:generateContent`;
  }

  _getModelsUrl() {
    return `${this.baseUrl}/${API_VERSION}/models`;
  }

  _buildHeaders() {
    return {
      'Content-Type': 'application/json',
      // In a header, never as a `?key=` query parameter: the URL is logged on
      // every call and travels through the SSRF guard.
      'x-goog-api-key': this.apiKey,
    };
  }

  _buildRequestBody({ messages, temperature, maxTokens, responseFormat }) {
    const { system, conversation } = splitSystemMessages(messages);

    const body = {
      contents: conversation.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        maxOutputTokens: maxTokens || this._getMaxTokens(),
      },
    };

    if (system) body.systemInstruction = { parts: [{ text: system }] };
    if (temperature !== undefined)
      body.generationConfig.temperature = temperature;
    if (responseFormat && responseFormat.type === 'json_object') {
      body.generationConfig.responseMimeType = 'application/json';
    }

    return body;
  }

  _parseResponse(data) {
    // A blocked prompt comes back with no candidate at all. Saying so beats
    // "invalid response", which sends the admin looking at the wrong thing.
    if (data.promptFeedback && data.promptFeedback.blockReason) {
      throw new ProviderError(
        `Gemini blocked the prompt: ${data.promptFeedback.blockReason}`,
        CODES.INVALID_RESPONSE
      );
    }

    const candidate = (data.candidates || [])[0];

    // Checked before the structure test, not after: a thinking model that
    // spends its whole budget returns a candidate with no content at all, and
    // reporting that as "invalid response structure" sent the admin looking
    // for a bug where there was only a token limit.
    if (candidate && candidate.finishReason === 'MAX_TOKENS') {
      throw new ProviderError(
        'Gemini ran out of output tokens before answering',
        CODES.INVALID_RESPONSE
      );
    }
    if (candidate && candidate.finishReason === 'SAFETY') {
      throw new ProviderError(
        'Gemini stopped on a safety filter',
        CODES.INVALID_RESPONSE
      );
    }

    if (!candidate || !candidate.content) {
      throw new ProviderError(
        'Invalid response structure from gemini',
        CODES.INVALID_RESPONSE
      );
    }

    const content = (candidate.content.parts || [])
      .map((part) => part.text)
      .filter(Boolean)
      .join('');

    const usage = data.usageMetadata || {};
    return {
      content,
      usage: {
        promptTokens: usage.promptTokenCount || 0,
        completionTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0,
        cachedTokens: usage.cachedContentTokenCount || 0,
      },
    };
  }

  _mapErrorToCode(status, errorData) {
    if (status === 403) return CODES.INVALID_CREDENTIALS;
    if (status === 429) return CODES.QUOTA_EXCEEDED;
    // Google answers 400, not 401, for a bad key. Left as a generic API error
    // it reads as "something went wrong" when the fix is to paste a new key.
    if (status === 400) {
      const message =
        (errorData && errorData.error && errorData.error.message) || '';
      if (/API[_ ]KEY/i.test(message)) return CODES.INVALID_CREDENTIALS;
    }
    return CODES.API_ERROR;
  }

  /**
   * Lower than the OpenAI default: the `-latest` aliases point at thinking
   * models, whose reasoning comes out of the same output budget as the answer.
   * Anthropic lowered its limits for the same reason.
   */
  getBatchLimits() {
    return { maxKeys: 80, maxChars: 30000 };
  }

  /** Filtered at the source: the listing mixes in embedding and imaging models. */
  async listRemoteModels() {
    const payload = await fetchProviderJson(
      `${this.baseUrl}/${API_VERSION}/models?pageSize=1000`,
      {
        headers: this._buildHeaders(),
        label: 'Gemini models listing',
        mapErrorToCode: (status) => this._mapErrorToCode(status),
      }
    );

    return (payload.models || [])
      .filter((model) =>
        (model.supportedGenerationMethods || []).includes('generateContent')
      )
      .map((model) => ({
        // Reported as "models/gemini-...", but the id used everywhere else
        // is the bare name.
        id: String(model.name || '').replace(/^models\//, ''),
        label: model.displayName || null,
        description: model.description || null,
      }));
  }
}

module.exports = GeminiProvider;
