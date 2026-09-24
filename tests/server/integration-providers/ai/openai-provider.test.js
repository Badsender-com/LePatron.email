'use strict';

// Mock node-fetch before requiring the provider
const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);
// The SSRF guard does real DNS resolution; stub it so these unit tests stay
// offline and deterministic. SSRF blocking itself is covered in
// outbound-host.test.js.
jest.mock('../../../../packages/server/utils/outbound-host.js', () => ({
  assertOutboundHostAllowed: jest.fn().mockResolvedValue(undefined),
}));

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
      // Comes from the central catalogue now, not a constant in this class.
      expect(provider.getDefaultTranslationModel()).toBe('gpt-5-mini');
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

    it('should throw ProviderError with QUOTA_EXCEEDED when API returns 429', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () =>
          JSON.stringify({ error: { message: 'Rate limit exceeded' } }),
      });

      await expect(
        provider.translateBatch({
          texts: { text: 'Hello' },
          sourceLanguage: 'en',
          targetLanguage: 'fr',
        })
      ).rejects.toMatchObject({
        name: 'ProviderError',
        message: 'openai API error: 429 - Rate limit exceeded',
        code: 'PROVIDER_QUOTA_EXCEEDED',
      });
    });

    it('should throw ProviderError with INVALID_RESPONSE when response is not valid JSON', async () => {
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
      ).rejects.toMatchObject({
        name: 'ProviderError',
        message: expect.stringContaining(
          'Failed to parse translation response'
        ),
        code: 'PROVIDER_INVALID_RESPONSE',
      });
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

  // gpt-5 and the o-series reject `max_tokens` and any explicit temperature
  // with a 400; gpt-4o and gpt-4.1 still take both. Verified live in this PR.
  describe('request contract per model generation', () => {
    function mockCompletion() {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"text": "Hello"}' } }],
        }),
      });
    }

    function sentBody() {
      return JSON.parse(mockFetch.mock.calls[0][1].body);
    }

    function providerOn(model) {
      return new OpenAIProvider({ ...mockIntegration, config: { model } });
    }

    const translate = (p) =>
      p.translateBatch({
        texts: { text: 'Bonjour' },
        sourceLanguage: 'fr',
        targetLanguage: 'en',
      });

    it.each(['gpt-5-mini', 'gpt-5', 'o3-mini', 'o4-mini'])(
      '%s gets max_completion_tokens, no temperature, a low reasoning effort',
      async (model) => {
        mockCompletion();

        await translate(providerOn(model));

        const body = sentBody();
        expect(body.max_completion_tokens).toBeGreaterThan(0);
        expect(body).not.toHaveProperty('max_tokens');
        expect(body).not.toHaveProperty('temperature');
        expect(body.reasoning_effort).toBe('low');
      }
    );

    it.each(['gpt-4o-mini', 'gpt-4.1-mini'])(
      '%s keeps max_tokens and temperature, and gets no reasoning effort',
      async (model) => {
        mockCompletion();

        await translate(providerOn(model));

        const body = sentBody();
        expect(body.max_tokens).toBeGreaterThan(0);
        expect(body.temperature).toBe(0.3);
        expect(body).not.toHaveProperty('reasoning_effort');
      }
    );

    // The effort is a translation choice: skills keep the model's default.
    it('sends no reasoning effort from chatComplete', async () => {
      mockCompletion();

      await providerOn('gpt-5-mini').chatComplete({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(sentBody()).not.toHaveProperty('reasoning_effort');
    });
  });
});
