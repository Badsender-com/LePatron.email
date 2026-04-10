'use strict';

const fetch = require('node-fetch');
const BaseLLMProvider = require('./base-llm-provider');
const logger = require('../../utils/logger.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../provider-error.js');

const DEFAULT_MODEL = 'mixtral';
const API_BASE = 'https://api.infomaniak.com';

// Valid model aliases for Infomaniak chat completions API
// The /models endpoint returns full model names, but chat API only accepts these aliases
const VALID_CHAT_MODELS = [
  {
    id: 'mixtral',
    name: 'Mixtral',
    descriptionKey: 'integrations.models.recommended',
  },
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
 * Requires a productId in addition to the API key.
 *
 * Differences from the OpenAI base:
 *   - Endpoint path: /chat/completions (no /v1/ prefix)
 *   - Does NOT support response_format parameter
 *   - max_tokens capped at 5000
 */
class InfomaniakProvider extends BaseLLMProvider {
  constructor(integration) {
    super(integration);
    this.productId = integration.productId;
    if (!this.productId) {
      throw new ProviderError(
        'Infomaniak provider requires a productId',
        CODES.CONFIG_ERROR
      );
    }
    this.baseUrl = `${API_BASE}/1/ai/${this.productId}/openai`;
  }

  _getDefaultModel() {
    return DEFAULT_MODEL;
  }

  _getChatCompletionsUrl() {
    // Infomaniak omits the /v1/ prefix
    return `${this.baseUrl}/chat/completions`;
  }

  _supportsResponseFormat() {
    return false;
  }

  _getMaxTokens() {
    return 5000; // Infomaniak limit: 1-5000
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
      logger.error('Infomaniak validation error:', error.message);
      return false;
    }
  }

  /**
   * Static list of valid chat model aliases.
   * Note: The /models endpoint returns full model names (e.g. "swiss-ai/Apertus-70B-Instruct-2509")
   * but the chat completions API only accepts short aliases (e.g. "mixtral", "llama3").
   */
  getStaticModels() {
    return VALID_CHAT_MODELS.map((model) => ({
      id: model.id,
      name: model.name,
    }));
  }
}

module.exports = InfomaniakProvider;
