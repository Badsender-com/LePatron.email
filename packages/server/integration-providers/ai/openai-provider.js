'use strict';

const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const AIProviderInterface = require('./ai-provider.interface');

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_API_HOST = 'https://api.openai.com';

/**
 * OpenAI provider implementation
 */
class OpenAIProvider extends AIProviderInterface {
  constructor(integration) {
    super(integration);
    this.baseUrl = this.apiHost || DEFAULT_API_HOST;
  }

  /**
   * Validate OpenAI credentials by making a simple API call
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
      console.error('OpenAI validation error:', error.message);
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
   * Translate a batch of texts using OpenAI
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

  /**
   * Get system prompt for translation
   */
  _getSystemPrompt() {
    return 'You are a JSON translation API. You receive a JSON object and return the same JSON object with translated values. You MUST return valid JSON only, no markdown, no explanation. Keep the exact same structure and keys.';
  }

  /**
   * Call OpenAI Chat Completion API
   */
  // eslint-disable-next-line camelcase
  async _callChatCompletion({ model, messages, temperature, response_format }) {
    console.log('Calling OpenAI API with model:', model, 'at', this.baseUrl);

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
          (error.error && error.error.message) || 'Unknown error';
        console.error('OpenAI API error:', response.status, errorMessage);
        throw new Error(
          `OpenAI API error: ${response.status} - ${errorMessage}`
        );
      }

      const data = await response.json();

      // Check if we have a valid response
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error(
          'Invalid OpenAI response structure:',
          JSON.stringify(data).substring(0, 500)
        );
        throw new Error('Invalid response structure from OpenAI');
      }

      const content = data.choices[0].message.content;
      const usage = data.usage || {};
      console.log(
        `OpenAI response received in ${elapsed}s - length: ${
          content ? content.length : 0
        } chars, tokens: ${usage.total_tokens || 'N/A'}`
      );

      return content;
    } catch (error) {
      clearTimeout(timeoutId);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (error.name === 'AbortError') {
        console.error(
          `OpenAI API timeout after ${elapsed}s (limit: ${TIMEOUT_MS / 1000}s)`
        );
        throw new Error(
          'OpenAI API timeout - the request took too long. Try using a faster model like gpt-4o.'
        );
      }
      throw error;
    }
  }

  /**
   * Parse translation response from OpenAI
   */
  _parseTranslationResponse(responseContent) {
    try {
      // Handle empty or undefined response
      if (!responseContent) {
        console.error('OpenAI returned empty response');
        throw new Error('Empty response from OpenAI');
      }

      // Log raw response for debugging
      console.log(
        'OpenAI raw response (first 500 chars):',
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
      console.error('Failed to parse OpenAI response:', responseContent);
      throw new Error(`Failed to parse translation response: ${error.message}`);
    }
  }
}

module.exports = OpenAIProvider;
