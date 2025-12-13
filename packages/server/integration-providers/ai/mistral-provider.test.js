'use strict';

const MistralProvider = require('./mistral-provider');

// Mock fetch globally
global.fetch = jest.fn();

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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await provider.validateCredentials();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.mistral.ai/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: { Authorization: 'Bearer mistral-test-key-12345' },
        })
      );
    });

    it('should return false when API responds with error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await provider.validateCredentials();

      expect(result).toBe(false);
    });

    it('should return false when fetch throws', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

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

      global.fetch.mockResolvedValueOnce({
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
      expect(global.fetch).toHaveBeenCalledWith(
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
      global.fetch.mockResolvedValueOnce({
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

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      const userMessage = callBody.messages[1].content;

      expect(userMessage).toContain('from the original language to fr');
    });

    it('should throw error when API fails', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          message: 'Internal server error',
        }),
      });

      await expect(
        provider.translateBatch({
          texts: { text: 'Hello' },
          sourceLanguage: 'en',
          targetLanguage: 'fr',
        })
      ).rejects.toThrow('Mistral API error: 500 - Internal server error');
    });
  });

  describe('translateText', () => {
    it('should translate single text', async () => {
      global.fetch.mockResolvedValueOnce({
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
