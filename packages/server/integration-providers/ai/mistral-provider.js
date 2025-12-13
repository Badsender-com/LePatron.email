'use strict';

const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const AIProviderInterface = require('./ai-provider.interface');

const DEFAULT_MODEL = 'mistral-small-latest';
const DEFAULT_API_HOST = 'https://api.mistral.ai';

/**
 * Mistral AI provider implementation
 */
class MistralProvider extends AIProviderInterface {
  constructor(integration) {
    super(integration);
    this.baseUrl = this.apiHost || DEFAULT_API_HOST;
  }

  /**
   * Validate Mistral credentials by making a simple API call
   */
  async validateCredentials() {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Mistral validation error:', error.message);
      return false;
    }
  }

  /**
   * Get the default model for translation
   */
  getDefaultTranslationModel() {
    return this.config.model || DEFAULT_MODEL;
  }

  /**
   * Translate a batch of texts using Mistral
   */
  async translateBatch({ texts, sourceLanguage, targetLanguage }) {
    const model = this.getDefaultTranslationModel();
    const sourceDesc =
      sourceLanguage === 'auto' ? 'the original language' : sourceLanguage;

    const prompt = this._buildTranslationPrompt({
      texts,
      sourceDesc,
      targetLanguage,
    });

    const response = await this._callChatCompletion({
      model,
      messages: [
        {
          role: 'system',
          content: this._getSystemPrompt(),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    return this._parseTranslationResponse(response);
  }

  /**
   * Translate a single text
   */
  async translateText({ text, sourceLanguage, targetLanguage }) {
    const result = await this.translateBatch({
      texts: { text },
      sourceLanguage,
      targetLanguage,
    });
    return result.text;
  }

  /**
   * Build the translation prompt
   */
  _buildTranslationPrompt({ texts, sourceDesc, targetLanguage }) {
    const inputJson = JSON.stringify(texts, null, 2);
    console.log(
      'Translation input - keys count:',
      Object.keys(texts).length,
      '- size:',
      inputJson.length,
      'chars'
    );

    return `Translate the following JSON object values from ${sourceDesc} to ${targetLanguage}.

CRITICAL RULES:
1. Return ONLY a valid JSON object - no markdown, no explanation
2. The output MUST be a FLAT object with the EXACT SAME KEYS as the input
3. Keys contain dots like "data.headerBlock.titleText" - these are NOT nested objects, they are literal string keys with dots in them
4. DO NOT restructure, nest, or reorganize the JSON - keep it flat
5. Translate only the values, never modify the keys
6. Preserve all dynamic variables exactly: %%VAR%%, {{var}}, <%=var%>, @[var]
7. Do not translate URLs or email addresses

Example - if input is:
{"data.block.title": "Bonjour"}

Output MUST be:
{"data.block.title": "Hello"}

NOT this (wrong - nested structure):
{"data": {"block": {"title": "Hello"}}}

INPUT JSON:
${inputJson}

OUTPUT (flat JSON with exact same keys):`;
  }

  /**
   * Get system prompt for translation
   */
  _getSystemPrompt() {
    return 'You are a JSON translation API. You receive a FLAT JSON object with dot-notation keys like "data.block.title" and return the EXACT same flat structure with translated values. NEVER convert flat keys to nested objects. Return valid JSON only, no markdown.';
  }

  /**
   * Call Mistral Chat Completion API
   */
  // eslint-disable-next-line camelcase
  async _callChatCompletion({ model, messages, temperature, response_format }) {
    console.log('Calling Mistral API with model:', model, 'at', this.baseUrl);

    // Create abort controller for timeout (5 minutes for large translations)
    const TIMEOUT_MS = 300000; // 5 minutes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          response_format,
          max_tokens: 16000, // Ensure enough tokens for large translations
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const errorMessage =
          (error.error && error.error.message) ||
          error.message ||
          'Unknown error';
        console.error('Mistral API error:', response.status, errorMessage);
        throw new Error(
          `Mistral API error: ${response.status} - ${errorMessage}`
        );
      }

      const data = await response.json();

      // Check if we have a valid response
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error(
          'Invalid Mistral response structure:',
          JSON.stringify(data).substring(0, 500)
        );
        throw new Error('Invalid response structure from Mistral');
      }

      const content = data.choices[0].message.content;
      const usage = data.usage || {};
      console.log(
        `Mistral response received in ${elapsed}s - length: ${
          content ? content.length : 0
        } chars, tokens: ${usage.total_tokens || 'N/A'}`
      );

      return content;
    } catch (error) {
      clearTimeout(timeoutId);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (error.name === 'AbortError') {
        console.error(
          `Mistral API timeout after ${elapsed}s (limit: ${TIMEOUT_MS / 1000}s)`
        );
        throw new Error('Mistral API timeout - the request took too long.');
      }
      throw error;
    }
  }

  /**
   * Parse translation response from Mistral
   */
  _parseTranslationResponse(responseContent) {
    try {
      // Handle empty or undefined response
      if (!responseContent) {
        console.error('Mistral returned empty response');
        throw new Error('Empty response from Mistral');
      }

      // Log raw response for debugging
      console.log(
        'Mistral raw response (first 500 chars):',
        responseContent.substring(0, 500)
      );

      // Sometimes the model wraps JSON in markdown code blocks
      let cleanedContent = responseContent.trim();
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.slice(7);
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.slice(3);
      }
      if (cleanedContent.endsWith('```')) {
        cleanedContent = cleanedContent.slice(0, -3);
      }
      cleanedContent = cleanedContent.trim();

      return JSON.parse(cleanedContent);
    } catch (error) {
      console.error('Failed to parse Mistral response:', responseContent);
      throw new Error(`Failed to parse translation response: ${error.message}`);
    }
  }
}

module.exports = MistralProvider;
