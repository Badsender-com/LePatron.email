'use strict';

// Mock node-fetch before requiring the provider
const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);

const MistralProvider = require('../../../../packages/server/integration-providers/ai/mistral-provider');

describe('MistralProvider', () => {
  let provider;
  const mockIntegration = {
    provider: 'mistral',
    apiKey: 'mistral-test-key-12345',
    apiHost: null,
    config: {},
  };

  beforeEach(() => {
    provider = new MistralProvider(mockIntegration);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use default API host when not provided', () => {
      expect(provider.baseUrl).toBe('https://api.mistral.ai');
    });

    it('should use custom API host when provided', () => {
      const customIntegration = {
        ...mockIntegration,
        apiHost: 'https://custom.mistral.ai',
      };
      const customProvider = new MistralProvider(customIntegration);

      expect(customProvider.baseUrl).toBe('https://custom.mistral.ai');
    });
  });

  describe('getDefaultTranslationModel', () => {
    it('should return default model when not configured', () => {
      expect(provider.getDefaultTranslationModel()).toBe(
        'mistral-small-latest'
      );
    });

    it('should return configured model', () => {
      const customIntegration = {
        ...mockIntegration,
        config: { model: 'mistral-large-latest' },
      };
      const customProvider = new MistralProvider(customIntegration);

      expect(customProvider.getDefaultTranslationModel()).toBe(
        'mistral-large-latest'
      );
    });
  });

  describe('validateCredentials', () => {
    it('should return true when API responds with 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await provider.validateCredentials();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mistral.ai/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: { Authorization: 'Bearer mistral-test-key-12345' },
        })
      );
    });

    it('should return false when API responds with error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await provider.validateCredentials();

      expect(result).toBe(false);
    });

    it('should return false when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.validateCredentials();

      expect(result).toBe(false);
    });
  });

  describe('translateBatch', () => {
    it('should translate batch of texts', async () => {
      const mockResponse = {
        subject: 'Discover our new arrivals',
        body: 'Hello there!',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockResponse),
              },
            },
          ],
        }),
      });

      const result = await provider.translateBatch({
        texts: {
          subject: 'Découvrez nos nouveautés',
          body: 'Bonjour !',
        },
        sourceLanguage: 'fr',
        targetLanguage: 'en',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mistral.ai/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer mistral-test-key-12345',
          }),
        })
      );
    });

    it('should use auto language detection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"text": "Bonjour"}' } }],
        }),
      });

      await provider.translateBatch({
        texts: { text: 'Hello' },
        sourceLanguage: 'auto',
        targetLanguage: 'fr',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMessage = callBody.messages[1].content;

      expect(userMessage).toContain('from the original language to fr');
    });

    it('should throw ProviderError with API_ERROR when API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ message: 'Internal server error' }),
      });

      await expect(
        provider.translateBatch({
          texts: { text: 'Hello' },
          sourceLanguage: 'en',
          targetLanguage: 'fr',
        })
      ).rejects.toMatchObject({
        name: 'ProviderError',
        message: 'mistral API error: 500 - Internal server error',
        code: 'PROVIDER_API_ERROR',
      });
    });
  });

  describe('translateText', () => {
    it('should translate single text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"text": "Bonjour"}' } }],
        }),
      });

      const result = await provider.translateText({
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
      });

      expect(result).toBe('Bonjour');
    });
  });
});
