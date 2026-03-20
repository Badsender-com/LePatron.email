'use strict';

const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const AIProviderInterface = require('./ai-provider.interface');

const DEFAULT_MODEL = 'mixtral';
const API_BASE = 'https://api.infomaniak.com';

// Valid model aliases for Infomaniak chat completions API
// The /models endpoint returns full model names, but chat API only accepts these aliases
const VALID_CHAT_MODELS = [
  { id: 'mixtral', name: 'Mixtral (recommended)' },
  { id: 'llama3', name: 'LLaMA 3' },
  { id: 'granite', name: 'Granite' },
  { id: 'mistral24b', name: 'Mistral 24B' },
  { id: 'mistral3', name: 'Mistral 3' },
  { id: 'qwen3', name: 'Qwen 3' },
  { id: 'gemma3n', name: 'Gemma 3n' },
];

/**
 * Infomaniak AI Tools provider implementation
 * API compatible with OpenAI, hosted in Switzerland (data sovereignty, GDPR compliant)
 * Requires a productId in addition to the API key
 */
class InfomaniakProvider extends AIProviderInterface {
  constructor(integration) {
    super(integration);
    this.productId = integration.productId;
    if (!this.productId) {
      throw new Error('Infomaniak provider requires a productId');
    }
    // Build the base URL with productId
    this.baseUrl = `${API_BASE}/1/ai/${this.productId}/openai`;
  }

  /**
   * Validate Infomaniak credentials by listing AI products
   */
  async validateCredentials() {
    try {
      const response = await fetch(`${API_BASE}/1/ai`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Infomaniak validation error:', error.message);
      return false;
    }
  }

  /**
   * Get available models for this Infomaniak AI Tools product
   * Returns the static list of valid chat model aliases
   * Note: The /models endpoint returns full model names (e.g. "swiss-ai/Apertus-70B-Instruct-2509")
   * but the chat completions API only accepts short aliases (e.g. "mixtral", "llama3")
   */
  async getAvailableModels() {
    // Return static list of valid chat models
    // Infomaniak chat API only accepts these specific model aliases
    return VALID_CHAT_MODELS.map((model) => ({
      id: model.id,
      name: model.name,
      type: 'chat',
    }));
  }

  /**
   * Get the default model for translation
   */
  getDefaultTranslationModel() {
    return this.config.model || DEFAULT_MODEL;
  }

  /**
   * Translate a batch of texts using Infomaniak AI Tools
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

    // Note: Infomaniak API does NOT support response_format parameter
    // We rely on the prompt instructions to get JSON output
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
   * Call Infomaniak Chat Completion API (OpenAI-compatible)
   */
  async _callChatCompletion({ model, messages, temperature }) {
    // Create abort controller for timeout (5 minutes for large translations)
    const TIMEOUT_MS = 300000; // 5 minutes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const startTime = Date.now();

    const requestBody = {
      model,
      messages,
      temperature,
      max_tokens: 5000, // Infomaniak limit: 1-5000
    };

    console.log(
      'Calling Infomaniak API with model:',
      model,
      'at',
      this.baseUrl
    );
    console.log(
      'Request body (truncated):',
      JSON.stringify(requestBody).substring(0, 500)
    );

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
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
        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
          errorMessage =
            errorData.error?.message ||
            errorData.message ||
            errorData.result?.message ||
            JSON.stringify(errorData);
        } catch {
          errorMessage = errorText || 'Unknown error';
        }
        console.error(
          'Infomaniak API error:',
          response.status,
          'Full response:',
          errorText.substring(0, 1000)
        );
        throw new Error(
          `Infomaniak API error: ${response.status} - ${errorMessage}`
        );
      }

      const data = await response.json();

      // Check if we have a valid response
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error(
          'Invalid Infomaniak response structure:',
          JSON.stringify(data).substring(0, 500)
        );
        throw new Error('Invalid response structure from Infomaniak');
      }

      const content = data.choices[0].message.content;
      const usage = data.usage || {};
      console.log(
        `Infomaniak response received in ${elapsed}s - length: ${
          content ? content.length : 0
        } chars, tokens: ${usage.total_tokens || 'N/A'}`
      );

      return content;
    } catch (error) {
      clearTimeout(timeoutId);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (error.name === 'AbortError') {
        console.error(
          `Infomaniak API timeout after ${elapsed}s (limit: ${TIMEOUT_MS / 1000}s)`
        );
        throw new Error(
          'Infomaniak API timeout - the request took too long. Try using a faster model.'
        );
      }
      throw error;
    }
  }

  /**
   * Parse translation response from Infomaniak
   */
  _parseTranslationResponse(responseContent) {
    try {
      // Handle empty or undefined response
      if (!responseContent) {
        console.error('Infomaniak returned empty response');
        throw new Error('Empty response from Infomaniak');
      }

      // Log raw response for debugging
      console.log(
        'Infomaniak raw response (first 500 chars):',
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
      console.error('Failed to parse Infomaniak response:', responseContent);
      throw new Error(`Failed to parse translation response: ${error.message}`);
    }
  }
}

module.exports = InfomaniakProvider;
