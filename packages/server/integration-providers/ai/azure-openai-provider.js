'use strict';

const OpenAIProvider = require('./openai-provider');
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

  /**
   * A deployment is named by the customer, so `prod-chat` may well run gpt-5:
   * the name says nothing, and guessing wrong is a 400 on every call. The
   * admin says so with `config.reasoningModel`; a deployment named after its
   * model still works without it.
   */
  _isNewContractModel(model) {
    return (
      this.config.reasoningModel === true || super._isNewContractModel(model)
    );
  }

  /**
   * Never sent here: Azure only accepts it from API versions later than the
   * pinned default, and an unknown parameter fails the request.
   */
  _supportsReasoningEffort() {
    return false;
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
    )}/chat/completions?api-version=${encodeURIComponent(this.apiVersion)}`;
  }

  /** Azure lists deployments, not models. */
  _getModelsUrl() {
    return `${this.baseUrl}/openai/deployments?api-version=${encodeURIComponent(
      this.apiVersion
    )}`;
  }

  _buildHeaders() {
    return {
      'Content-Type': 'application/json',
      // Not Authorization/Bearer: Azure answers 401 with nothing actionable.
      'api-key': this.apiKey,
    };
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
