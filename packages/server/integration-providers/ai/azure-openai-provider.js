'use strict';

const fetch = require('node-fetch');
const OpenAIProvider = require('./openai-provider');
const logger = require('../../utils/logger.js');
const { assertOutboundHostAllowed } = require('../../utils/outbound-host.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../provider-error.js');

// Pinned rather than "latest": Azure dates its API versions and an older pin
// keeps working, where following the newest moves the contract silently.
const DEFAULT_API_VERSION = '2024-10-21';

/**
 * Azure OpenAI.
 *
 * Same dialect as OpenAI, two differences that both fail unhelpfully when
 * missed: the key travels in an `api-key` header rather than a Bearer token,
 * and the model is a customer-chosen *deployment name* in the path.
 *
 * Configuration lives in `config` (deployment, apiVersion), never as a root
 * field — the productId incident showed that an undeclared root field is
 * dropped by Mongoose without a word.
 */
class AzureOpenAIProvider extends OpenAIProvider {
  constructor(integration) {
    super(integration);
    if (!this.apiHost) {
      throw new ProviderError(
        'Azure OpenAI requires the resource host (apiHost)',
        CODES.CONFIG_ERROR
      );
    }
    this.baseUrl = this.apiHost;
    this.apiVersion = this.config.apiVersion || DEFAULT_API_VERSION;
  }

  /** The deployment name doubles as the model name. */
  _getDeployment(model) {
    return this.config.deployment || model || this.config.model;
  }

  _getDefaultModel() {
    const deployment = this._getDeployment();
    if (!deployment) {
      throw new ProviderError(
        'Azure OpenAI requires a deployment name',
        CODES.CONFIG_ERROR
      );
    }
    return deployment;
  }

  _getEndpointUrl(model) {
    return `${this.baseUrl}/openai/deployments/${encodeURIComponent(
      this._getDeployment(model)
    )}/chat/completions?api-version=${this.apiVersion}`;
  }

  _buildHeaders() {
    return {
      'Content-Type': 'application/json',
      // Not Authorization/Bearer: Azure answers 401 with nothing actionable.
      'api-key': this.apiKey,
    };
  }

  async validateCredentials() {
    try {
      await assertOutboundHostAllowed(this.baseUrl);
      const response = await fetch(
        `${this.baseUrl}/openai/deployments?api-version=${this.apiVersion}`,
        { method: 'GET', headers: this._buildHeaders() }
      );
      return response.ok;
    } catch (error) {
      logger.error('Azure OpenAI validation error:', error.message);
      return false;
    }
  }

  /**
   * Deployment names are chosen by the customer, so nothing can be inferred
   * from them and the catalogue has no entries. The free-typed model field is
   * what makes this provider usable at all.
   */
  async listRemoteModels() {
    return null;
  }
}

module.exports = AzureOpenAIProvider;
