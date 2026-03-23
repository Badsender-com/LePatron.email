'use strict';

// Mock node-fetch before requiring the provider
const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);

const OpenAIProvider = require('../../../../packages/server/integration-providers/ai/openai-provider');

describe('OpenAIProvider', () => {
  let provider;
  const mockIntegration = {
    provider: 'openai',
    apiKey: 'sk-test-key-12345',
    apiHost: null,
    config: {},
  };

  beforeEach(() => {
    provider = new OpenAIProvider(mockIntegration);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use default API host when not provided', () => {
      expect(provider.baseUrl).toBe('https://api.openai.com');
    });

    it('should use custom API host when provided', () => {
      const customIntegration = {
        ...mockIntegration,
        apiHost: 'https://custom.openai.com',
      };
      const customProvider = new OpenAIProvider(customIntegration);

      expect(customProvider.baseUrl).toBe('https://custom.openai.com');
    });
  });

  describe('getDefaultTranslationModel', () => {
    it('should return default model when not configured', () => {
      expect(provider.getDefaultTranslationModel()).toBe('gpt-4o-mini');
    });

    it('should return configured model', () => {
      const customIntegration = {
        ...mockIntegration,
        config: { model: 'gpt-4o' },
      };
      const customProvider = new OpenAIProvider(customIntegration);

      expect(customProvider.getDefaultTranslationModel()).toBe('gpt-4o');
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
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: { Authorization: 'Bearer sk-test-key-12345' },
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
        'blocks.0.content': 'Hello %%FIRSTNAME%%, here is our selection.',
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
          'blocks.0.content': 'Bonjour %%FIRSTNAME%%, voici notre sélection.',
        },
        sourceLanguage: 'fr',
        targetLanguage: 'en',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer sk-test-key-12345',
          }),
        })
      );
    });

    it('should preserve dynamic variables in prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"text": "Hello"}' } }],
        }),
      });

      await provider.translateBatch({
        texts: { text: 'Bonjour %%PRENOM%%' },
        sourceLanguage: 'auto',
        targetLanguage: 'en',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMessage = callBody.messages[1].content;

      expect(userMessage).toContain('%%VARIABLE%%');
      expect(userMessage).toContain('{{variable}}');
      expect(userMessage).toContain('<%=variable%>');
      expect(userMessage).toContain('@[variable]');
    });

    it('should throw error when API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: { message: 'Rate limit exceeded' },
        }),
      });

      await expect(
        provider.translateBatch({
          texts: { text: 'Hello' },
          sourceLanguage: 'en',
          targetLanguage: 'fr',
        })
      ).rejects.toThrow('OpenAI API error: 429 - Rate limit exceeded');
    });

    it('should throw error when response is not valid JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'not valid json' } }],
        }),
      });

      await expect(
        provider.translateBatch({
          texts: { text: 'Hello' },
          sourceLanguage: 'en',
          targetLanguage: 'fr',
        })
      ).rejects.toThrow('Failed to parse translation response');
    });
  });

  describe('translateText', () => {
    it('should translate single text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"text": "Hello"}' } }],
        }),
      });

      const result = await provider.translateText({
        text: 'Bonjour',
        sourceLanguage: 'fr',
        targetLanguage: 'en',
      });

      expect(result).toBe('Hello');
    });
  });
});
