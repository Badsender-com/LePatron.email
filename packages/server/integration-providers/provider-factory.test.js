'use strict';

const ProviderFactory = require('./provider-factory');
const OpenAIProvider = require('./ai/openai-provider');
const MistralProvider = require('./ai/mistral-provider');
const InfomaniakProvider = require('./ai/infomaniak-provider');
const IntegrationProviders = require('../constant/integration-provider');

describe('ProviderFactory', () => {
  describe('createProvider', () => {
    it('should create an OpenAI provider', () => {
      const integration = {
        provider: IntegrationProviders.OPENAI,
        apiKey: 'test-api-key',
        apiHost: null,
        config: {},
      };

      const provider = ProviderFactory.createProvider(integration);

      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.apiKey).toBe('test-api-key');
    });

    it('should create a Mistral provider', () => {
      const integration = {
        provider: IntegrationProviders.MISTRAL,
        apiKey: 'test-api-key',
        apiHost: 'https://custom.mistral.ai',
        config: { model: 'mistral-large-latest' },
      };

      const provider = ProviderFactory.createProvider(integration);

      expect(provider).toBeInstanceOf(MistralProvider);
      expect(provider.apiKey).toBe('test-api-key');
      expect(provider.baseUrl).toBe('https://custom.mistral.ai');
    });

    it('should create an Infomaniak provider', () => {
      const integration = {
        provider: IntegrationProviders.INFOMANIAK,
        apiKey: 'test-api-key',
        productId: 'test-product-id',
        apiHost: null,
        config: {},
      };

      const provider = ProviderFactory.createProvider(integration);

      expect(provider).toBeInstanceOf(InfomaniakProvider);
      expect(provider.apiKey).toBe('test-api-key');
      expect(provider.productId).toBe('test-product-id');
    });

    it('should throw error for unsupported provider', () => {
      const integration = {
        provider: 'unsupported-provider',
        apiKey: 'test-api-key',
      };

      expect(() => ProviderFactory.createProvider(integration)).toThrow(
        'Unsupported provider: unsupported-provider'
      );
    });
  });

  describe('isProviderSupported', () => {
    it('should return true for OpenAI', () => {
      expect(
        ProviderFactory.isProviderSupported(IntegrationProviders.OPENAI)
      ).toBe(true);
    });

    it('should return true for Mistral', () => {
      expect(
        ProviderFactory.isProviderSupported(IntegrationProviders.MISTRAL)
      ).toBe(true);
    });

    it('should return true for Infomaniak', () => {
      expect(
        ProviderFactory.isProviderSupported(IntegrationProviders.INFOMANIAK)
      ).toBe(true);
    });

    it('should return false for unsupported provider', () => {
      expect(ProviderFactory.isProviderSupported('deepl')).toBe(false);
    });
  });

  describe('getSupportedProviders', () => {
    it('should return array of supported providers', () => {
      const providers = ProviderFactory.getSupportedProviders();

      expect(providers).toContain(IntegrationProviders.OPENAI);
      expect(providers).toContain(IntegrationProviders.MISTRAL);
      expect(providers).toContain(IntegrationProviders.INFOMANIAK);
      expect(providers.length).toBe(3);
    });
  });
});
