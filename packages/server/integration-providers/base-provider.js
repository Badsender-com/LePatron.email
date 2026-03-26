'use strict';

/**
 * Base class for all integration providers
 * All providers must implement the required methods
 */
class BaseProvider {
  constructor(integration) {
    this.integration = integration;
    this.apiKey = integration.apiKey;
    this.apiHost = integration.apiHost;
    this.config = integration.config || {};
  }

  /**
   * Validate the provider credentials
   * @returns {Promise<boolean>} True if credentials are valid
   */
  async validateCredentials() {
    throw new Error('Method validateCredentials() must be implemented');
  }

  /**
   * Get the provider type
   * @returns {string} Provider type identifier
   */
  getProviderType() {
    return this.integration.provider;
  }

  /**
   * Get the integration type
   * @returns {string} Integration type identifier
   */
  getIntegrationType() {
    return this.integration.type;
  }

  /**
   * Get batch limits for translation batching.
   * Override in subclasses with provider-specific constraints.
   * @returns {{ maxKeys: number, maxChars: number }}
   */
  getBatchLimits() {
    return { maxKeys: 100, maxChars: 50000 };
  }
}

module.exports = BaseProvider;
