'use strict';

const BaseLLMProvider = require('./base-llm-provider');
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
    // Encoded although the service only lets digits through: this is the path
    // the API key is sent to, and an integration saved before that check
    // would otherwise still reshape it.
    this.baseUrl = `${API_BASE}/1/ai/${encodeURIComponent(
      this.productId
    )}/openai`;
  }

  /**
   * The product inventory, not a model list: this endpoint answers for the
   * account rather than the product, which is what a credential check needs.
   */
  _getModelsUrl() {
    return `${API_BASE}/1/ai`;
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
   * Deliberately no `listRemoteModels()` override: the /models endpoint
   * returns full model names (e.g. "swiss-ai/Apertus-70B-Instruct-2509")
   * while the chat completions API only accepts short aliases ("mixtral",
   * "llama3"). Listing them would offer the admin models every call would
   * then reject. The base class returns null — "no usable listing" — and the
   * catalogue stays the only source for this provider.
   */
}

module.exports = InfomaniakProvider;
