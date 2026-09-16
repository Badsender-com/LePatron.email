'use strict';

const OpenAIProvider = require('./openai-provider');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../provider-error.js');

/**
 * Any endpoint speaking the OpenAI chat-completions contract: OpenRouter,
 * Groq, Together, vLLM, Ollama, a sovereign cloud, an in-house gateway.
 *
 * Note the SSRF guard applies here as everywhere: it rejects private and
 * loopback addresses, so a self-hosted model on the customer's own network is
 * out of reach until an operator-level allowlist exists. That is deliberate —
 * the alternative is letting a group admin point the API key at an internal
 * host.
 */
class OpenAICompatibleProvider extends OpenAIProvider {
  constructor(integration) {
    super(integration);
    this.baseUrl = this.apiHost || this._getDefaultApiHost();
    if (!this.baseUrl) {
      throw new ProviderError(
        'An OpenAI-compatible integration requires its endpoint (apiHost)',
        CODES.CONFIG_ERROR
      );
    }
  }

  /**
   * Host to use when the integration leaves apiHost empty. Null here on
   * purpose — a generic endpoint has no sensible default — while named
   * services (Scaleway, OVHcloud) override it with their own.
   */
  _getDefaultApiHost() {
    return null;
  }

  /**
   * No catalogue for these: the models depend on the endpoint, so the group
   * has to name one. The controller already wraps this call in a try/catch and
   * reports "no default" rather than failing the screen.
   */
  _getDefaultModel() {
    const model = this.config.model;
    if (!model) {
      throw new ProviderError(
        `A model name is required for ${this.getProviderType()}`,
        CODES.CONFIG_ERROR
      );
    }
    return model;
  }

  /**
   * Opt-in, defaulting to false: we cannot promise JSON mode on an endpoint we
   * know nothing about, and a false promise makes skills fail at output
   * parsing rather than degrade to the repair pass.
   */
  supportsJsonResponseFormat() {
    return this.config.supportsJsonMode === true;
  }

  _supportsResponseFormat() {
    return this.config.supportsJsonMode === true;
  }

  /**
   * Many of these backends expose /v1/models, many do not. Inherited from
   * OpenAIProvider; a failure degrades to the catalogue and free typing, which
   * is the normal state for this provider.
   */
}

module.exports = OpenAICompatibleProvider;
