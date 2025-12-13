'use strict';

const IntegrationProviders = require('../constant/integration-provider');
const OpenAIProvider = require('./ai/openai-provider');
const MistralProvider = require('./ai/mistral-provider');

/**
 * Map of provider identifiers to their implementations
 */
const PROVIDER_MAP = {
  [IntegrationProviders.OPENAI]: OpenAIProvider,
  [IntegrationProviders.MISTRAL]: MistralProvider,
};

/**
 * Factory for creating provider instances
 */
class ProviderFactory {
  /**
   * Create a provider instance from an integration document
   * @param {Object} integration Mongoose integration document
   * @param {Object} [featureConfig] Optional feature-specific configuration
   * @returns {BaseProvider} Provider instance
   * @throws {Error} If provider is not supported
   */
  static createProvider(integration, featureConfig) {
    const ProviderClass = PROVIDER_MAP[integration.provider];

    if (!ProviderClass) {
      throw new Error(`Unsupported provider: ${integration.provider}`);
    }

    // Convert Mongoose document to plain object if needed
    const integrationObj = integration.toObject
      ? integration.toObject()
      : integration;

    // Merge feature config into integration config
    const integrationWithFeatureConfig = {
      ...integrationObj,
      config: {
        ...(integrationObj.config || {}),
        ...(featureConfig || {}),
      },
    };

    return new ProviderClass(integrationWithFeatureConfig);
  }

  /**
   * Check if a provider is supported
   * @param {string} provider Provider identifier
   * @returns {boolean} True if provider is supported
   */
  static isProviderSupported(provider) {
    return provider in PROVIDER_MAP;
  }

  /**
   * Get list of supported providers
   * @returns {string[]} Array of supported provider identifiers
   */
  static getSupportedProviders() {
    return Object.keys(PROVIDER_MAP);
  }
}

module.exports = ProviderFactory;
