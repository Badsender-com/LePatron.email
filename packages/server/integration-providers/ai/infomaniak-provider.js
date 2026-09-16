'use strict';

const fetch = require('node-fetch');
const BaseLLMProvider = require('./base-llm-provider');
const logger = require('../../utils/logger.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../provider-error.js');

const API_BASE = 'https://api.infomaniak.com';

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
   * Deliberately no `listRemoteModels()` override: the /models endpoint
   * returns full model names (e.g. "swiss-ai/Apertus-70B-Instruct-2509")
   * while the chat completions API only accepts short aliases ("mixtral",
   * "llama3"). Listing them would offer the admin models every call would
   * then reject. The base class returns null — "no usable listing" — and the
   * catalogue stays the only source for this provider.
   */
}

module.exports = InfomaniakProvider;
