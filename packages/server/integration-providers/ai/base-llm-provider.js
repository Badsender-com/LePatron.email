'use strict';

const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const AIProviderInterface = require('./ai-provider.interface');
const logger = require('../../utils/logger.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../provider-error.js');

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
 *   - getStaticModels()                 — static fallback model list
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
   * Static fallback models shown when dynamic listing fails.
   * Subclasses with a well-known model list should override this.
   */
  getStaticModels() {
    return [];
  }

  /**
   * Get the model to use for translation.
   * Reads from integration config first, falls back to the provider default.
   */
  getDefaultTranslationModel() {
    return this.config.model || this._getDefaultModel();
  }

  // ─── hooks ────────────────────────────────────────────────────────────────

  /** @abstract */
  _getDefaultModel() {
    throw new Error('_getDefaultModel() must be implemented by subclass');
  }

  /** URL for the chat completions endpoint. Override for non-standard paths. */
  _getChatCompletionsUrl() {
    return `${this.baseUrl}/v1/chat/completions`;
  }

  /** Whether the provider accepts the response_format parameter. */
  _supportsResponseFormat() {
    return true;
  }

  /** Maximum tokens to request. */
  _getMaxTokens() {
    return 16000;
  }

  // ─── translation ──────────────────────────────────────────────────────────

  async translateBatch({ texts, sourceLanguage, targetLanguage }) {
    const model = this.getDefaultTranslationModel();
    const sourceDesc =
      sourceLanguage === 'auto' ? 'the original language' : sourceLanguage;

    const prompt = this._buildTranslationPrompt({
      texts,
      sourceDesc,
      targetLanguage,
    });

    const completionOptions = {
      model,
      messages: [
        { role: 'system', content: this._getSystemPrompt() },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    };

    if (this._supportsResponseFormat()) {
      completionOptions.responseFormat = { type: 'json_object' };
    }

    const response = await this._callChatCompletion(completionOptions);
    return this._parseTranslationResponse(response);
  }

  async translateText({ text, sourceLanguage, targetLanguage }) {
    const result = await this.translateBatch({
      texts: { text },
      sourceLanguage,
      targetLanguage,
    });
    return result.text;
  }

  // ─── prompt building ──────────────────────────────────────────────────────

  _buildTranslationPrompt({ texts, sourceDesc, targetLanguage }) {
    const inputJson = JSON.stringify(texts, null, 2);
    logger.log(
      'Translation input - keys count:',
      Object.keys(texts).length,
      '- size:',
      inputJson.length,
      'chars'
    );

    return `Translate the following JSON object values from ${sourceDesc} to ${targetLanguage}.

IMPORTANT RULES:
1. Return ONLY a valid JSON object with the exact same keys
2. Translate only the values, never the keys
3. Preserve all dynamic variables exactly as they are:
   - %%VARIABLE%%, {{variable}}, <%=variable%>, @[variable]
4. Do not translate URLs or email addresses
5. Do not add any explanation, comments or markdown - just the JSON object

INPUT JSON:
${inputJson}

OUTPUT (valid JSON only):`;
  }

  _getSystemPrompt() {
    return 'You are a JSON translation API. You receive a JSON object and return the same JSON object with translated values. You MUST return valid JSON only, no markdown, no explanation. Keep the exact same structure and keys.';
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

  // ─── API call ─────────────────────────────────────────────────────────────

  // eslint-disable-next-line camelcase
  async _callChatCompletion({ model, messages, temperature, responseFormat }) {
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
      const requestBody = {
        model,
        messages,
        temperature,
        max_tokens: this._getMaxTokens(),
      };

      if (responseFormat) {
        requestBody.response_format = responseFormat;
      }

      const response = await fetch(this._getChatCompletionsUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMessage = 'Unknown error';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage =
            (errorData.error && errorData.error.message) ||
            errorData.message ||
            (errorData.result && errorData.result.message) ||
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
        const code =
          response.status === 401
            ? CODES.INVALID_CREDENTIALS
            : response.status === 429
            ? CODES.QUOTA_EXCEEDED
            : CODES.API_ERROR;
        throw new ProviderError(
          `${providerName} API error: ${response.status} - ${errorMessage}`,
          code
        );
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        logger.error(`Invalid ${providerName} response structure`);
        throw new ProviderError(
          `Invalid response structure from ${providerName}`,
          CODES.INVALID_RESPONSE
        );
      }

      const content = data.choices[0].message.content;
      const usage = data.usage || {};
      logger.log(
        `${providerName} response received in ${elapsed}s - length: ${
          content ? content.length : 0
        } chars, tokens: ${usage.total_tokens || 'N/A'}`
      );

      return content;
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

  // ─── response parsing ─────────────────────────────────────────────────────

  _parseTranslationResponse(responseContent) {
    const providerName = this.getProviderType();
    try {
      if (!responseContent) {
        logger.error(`${providerName} returned empty response`);
        throw new ProviderError(
          `Empty response from ${providerName}`,
          CODES.INVALID_RESPONSE
        );
      }

      logger.log(
        `${providerName} raw response (first 500 chars):`,
        responseContent.substring(0, 500)
      );

      // Extract JSON from markdown code fences if present (e.g. ```json ... ```)
      const codeFenceMatch = responseContent.match(
        /```(?:json)?\s*\n?([\s\S]*?)```/i
      );
      const cleanedContent = (codeFenceMatch
        ? codeFenceMatch[1]
        : responseContent
      ).trim();

      return JSON.parse(cleanedContent);
    } catch (error) {
      // Log truncated response to avoid leaking sensitive data
      const truncated = responseContent
        ? responseContent.substring(0, 200) + '...'
        : '[empty]';
      logger.error(`Failed to parse ${providerName} response:`, truncated);
      throw new ProviderError(
        `Failed to parse translation response: ${error.message}`,
        CODES.INVALID_RESPONSE
      );
    }
  }
}

module.exports = BaseLLMProvider;
