'use strict';

const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);
jest.mock('../../../../packages/server/utils/outbound-host.js', () => ({
  assertOutboundHostAllowed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));

const GeminiProvider = require('../../../../packages/server/integration-providers/ai/gemini-provider');
const {
  PROVIDER_ERROR_CODES: CODES,
} = require('../../../../packages/server/integration-providers/provider-error.js');

function reply(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function generateResponse(overrides = {}) {
  return {
    candidates: [
      {
        content: { role: 'model', parts: [{ text: 'bonjour' }] },
        finishReason: 'STOP',
      },
    ],
    usageMetadata: {
      promptTokenCount: 11,
      candidatesTokenCount: 3,
      totalTokenCount: 14,
    },
    ...overrides,
  };
}

const sentBody = () => JSON.parse(mockFetch.mock.calls[0][1].body);
const sentUrl = () => String(mockFetch.mock.calls[0][0]);

describe('GeminiProvider', () => {
  let provider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GeminiProvider({
      provider: 'gemini',
      apiKey: 'goog-test-key',
      config: {},
    });
  });

  describe('request shape', () => {
    // The model belongs to the path here, which is why the endpoint hook takes
    // one at all.
    it('puts the model in the URL', async () => {
      mockFetch.mockResolvedValue(reply(generateResponse()));

      await provider.chatComplete({
        model: 'gemini-x',
        messages: [{ role: 'user', content: 'x' }],
      });

      expect(sentUrl()).toContain('/models/gemini-x:generateContent');
    });

    // The URL is logged on every call and goes through the SSRF guard: a key
    // in the query string would end up in the logs.
    it('sends the key as a header and never in the URL', async () => {
      mockFetch.mockResolvedValue(reply(generateResponse()));

      await provider.chatComplete({
        model: 'gemini-x',
        messages: [{ role: 'user', content: 'x' }],
      });

      expect(mockFetch.mock.calls[0][1].headers['x-goog-api-key']).toBe(
        'goog-test-key'
      );
      expect(sentUrl()).not.toContain('goog-test-key');
      expect(sentUrl()).not.toContain('key=');
    });

    it('moves system messages into systemInstruction', async () => {
      mockFetch.mockResolvedValue(reply(generateResponse()));

      await provider.chatComplete({
        model: 'gemini-x',
        messages: [
          { role: 'system', content: 'be terse' },
          { role: 'user', content: 'x' },
        ],
      });

      expect(sentBody().systemInstruction).toEqual({
        parts: [{ text: 'be terse' }],
      });
      expect(sentBody().contents).toEqual([
        { role: 'user', parts: [{ text: 'x' }] },
      ]);
    });

    it('renames the assistant role to model', async () => {
      mockFetch.mockResolvedValue(reply(generateResponse()));

      await provider.chatComplete({
        model: 'gemini-x',
        messages: [
          { role: 'user', content: 'x' },
          { role: 'assistant', content: 'y' },
        ],
      });

      expect(sentBody().contents.map((c) => c.role)).toEqual(['user', 'model']);
    });

    it('asks for JSON only when the caller does', async () => {
      mockFetch.mockResolvedValue(reply(generateResponse()));

      await provider.chatComplete({
        model: 'gemini-x',
        messages: [{ role: 'user', content: 'x' }],
      });
      expect(sentBody().generationConfig.responseMimeType).toBeUndefined();

      jest.clearAllMocks();
      mockFetch.mockResolvedValue(reply(generateResponse()));
      await provider.chatComplete({
        model: 'gemini-x',
        messages: [{ role: 'user', content: 'x' }],
        responseFormat: { type: 'json_object' },
      });
      expect(sentBody().generationConfig.responseMimeType).toBe(
        'application/json'
      );
    });
  });

  describe('response reading', () => {
    it('joins the parts of the first candidate', async () => {
      mockFetch.mockResolvedValue(
        reply(
          generateResponse({
            candidates: [
              {
                content: { parts: [{ text: 'Hello ' }, { text: 'world' }] },
                finishReason: 'STOP',
              },
            ],
          })
        )
      );

      const result = await provider.chatComplete({
        model: 'gemini-x',
        messages: [{ role: 'user', content: 'x' }],
      });

      expect(result.content).toBe('Hello world');
    });

    it('maps usageMetadata onto the names callers persist', async () => {
      mockFetch.mockResolvedValue(reply(generateResponse()));

      const { usage } = await provider.chatComplete({
        model: 'gemini-x',
        messages: [{ role: 'user', content: 'x' }],
      });

      expect(usage).toEqual({
        promptTokens: 11,
        completionTokens: 3,
        totalTokens: 14,
        cachedTokens: 0,
      });
    });

    // A blocked prompt comes back with no candidate: saying why beats
    // "invalid response", which sends the admin looking elsewhere.
    it('names a blocked prompt', async () => {
      mockFetch.mockResolvedValue(
        reply({ promptFeedback: { blockReason: 'SAFETY' } })
      );

      await expect(
        provider.chatComplete({
          model: 'gemini-x',
          messages: [{ role: 'user', content: 'x' }],
        })
      ).rejects.toThrow(/SAFETY/);
    });

    it('rejects a candidate stopped by a safety filter', async () => {
      mockFetch.mockResolvedValue(
        reply(
          generateResponse({
            candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }],
          })
        )
      );

      await expect(
        provider.chatComplete({
          model: 'gemini-x',
          messages: [{ role: 'user', content: 'x' }],
        })
      ).rejects.toMatchObject({ code: CODES.INVALID_RESPONSE });
    });
  });

  describe('error mapping', () => {
    // Google answers 400 for a bad key, not 401. Left generic it reads as
    // "something went wrong" when the fix is to paste a new key.
    it('recognises an invalid key behind a 400', async () => {
      mockFetch.mockResolvedValue(
        reply(
          {
            error: {
              code: 400,
              message: 'API_KEY_INVALID',
              status: 'INVALID_ARGUMENT',
            },
          },
          400
        )
      );

      await expect(
        provider.chatComplete({
          model: 'gemini-x',
          messages: [{ role: 'user', content: 'x' }],
        })
      ).rejects.toMatchObject({ code: CODES.INVALID_CREDENTIALS });
    });

    it('leaves an ordinary 400 as an API error', async () => {
      mockFetch.mockResolvedValue(
        reply({ error: { message: 'bad request' } }, 400)
      );

      await expect(
        provider.chatComplete({
          model: 'gemini-x',
          messages: [{ role: 'user', content: 'x' }],
        })
      ).rejects.toMatchObject({ code: CODES.API_ERROR });
    });

    it.each([
      [403, CODES.INVALID_CREDENTIALS],
      [429, CODES.QUOTA_EXCEEDED],
    ])('turns HTTP %s into %s', async (status, expected) => {
      mockFetch.mockResolvedValue(reply({ error: { message: 'x' } }, status));

      await expect(
        provider.chatComplete({
          model: 'gemini-x',
          messages: [{ role: 'user', content: 'x' }],
        })
      ).rejects.toMatchObject({ code: expected });
    });
  });

  describe('model listing', () => {
    it('keeps only models that can generate content, and strips the prefix', async () => {
      mockFetch.mockResolvedValue(
        reply({
          models: [
            {
              name: 'models/gemini-x',
              displayName: 'Gemini X',
              description: 'Fast one.',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/embedding-001',
              supportedGenerationMethods: ['embedContent'],
            },
          ],
        })
      );

      expect(await provider.listRemoteModels()).toEqual([
        { id: 'gemini-x', label: 'Gemini X', description: 'Fast one.' },
      ]);
    });
  });
});
