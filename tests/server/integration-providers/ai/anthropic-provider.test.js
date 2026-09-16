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

const AnthropicProvider = require('../../../../packages/server/integration-providers/ai/anthropic-provider');
const logger = require('../../../../packages/server/utils/logger.js');
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

function messageResponse(overrides = {}) {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-x',
    content: [{ type: 'text', text: 'bonjour' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 11, output_tokens: 3 },
    ...overrides,
  };
}

function sentBody() {
  return JSON.parse(mockFetch.mock.calls[0][1].body);
}
function sentHeaders() {
  return mockFetch.mock.calls[0][1].headers;
}

describe('AnthropicProvider', () => {
  let provider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new AnthropicProvider({
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      config: {},
    });
  });

  describe('request shape', () => {
    it('authenticates with x-api-key and a pinned version, never a Bearer token', async () => {
      mockFetch.mockResolvedValue(reply(messageResponse()));

      await provider.chatComplete({
        model: 'claude-x',
        messages: [{ role: 'user', content: 'x' }],
      });

      expect(sentHeaders()['x-api-key']).toBe('sk-ant-test');
      expect(sentHeaders()['anthropic-version']).toBeTruthy();
      // Anthropic answers 401 with nothing actionable when sent a Bearer token.
      expect(sentHeaders().Authorization).toBeUndefined();
    });

    it('posts to the messages endpoint', async () => {
      mockFetch.mockResolvedValue(reply(messageResponse()));

      await provider.chatComplete({
        model: 'claude-x',
        messages: [{ role: 'user', content: 'x' }],
      });

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://api.anthropic.com/v1/messages'
      );
    });

    // The system prompt is a top-level field here, not a message. Left in the
    // conversation it would be rejected; dropped, the instructions vanish.
    it('lifts system messages out of the conversation', async () => {
      mockFetch.mockResolvedValue(reply(messageResponse()));

      await provider.chatComplete({
        model: 'claude-x',
        messages: [
          { role: 'system', content: 'be terse' },
          { role: 'user', content: 'x' },
        ],
      });

      expect(sentBody().system).toBe('be terse');
      expect(sentBody().messages).toEqual([{ role: 'user', content: 'x' }]);
    });

    it('joins several system messages rather than keeping one', async () => {
      mockFetch.mockResolvedValue(reply(messageResponse()));

      await provider.chatComplete({
        model: 'claude-x',
        messages: [
          { role: 'system', content: 'one' },
          { role: 'system', content: 'two' },
          { role: 'user', content: 'x' },
        ],
      });

      expect(sentBody().system).toContain('one');
      expect(sentBody().system).toContain('two');
    });

    // max_tokens is mandatory on this API: there is no model default to fall
    // back on, so omitting it fails the call outright.
    it('always sends max_tokens', async () => {
      mockFetch.mockResolvedValue(reply(messageResponse()));

      await provider.chatComplete({
        model: 'claude-x',
        messages: [{ role: 'user', content: 'x' }],
      });

      expect(sentBody().max_tokens).toBeGreaterThan(0);
    });

    it('never sends response_format, which this API does not accept', async () => {
      mockFetch.mockResolvedValue(reply(messageResponse()));

      await provider.chatComplete({
        model: 'claude-x',
        messages: [{ role: 'user', content: 'x' }],
        responseFormat: { type: 'json_object' },
      });

      expect(sentBody().response_format).toBeUndefined();
    });
  });

  describe('response reading', () => {
    it('concatenates text blocks and ignores the others', async () => {
      mockFetch.mockResolvedValue(
        reply(
          messageResponse({
            content: [
              { type: 'thinking', thinking: 'internal reasoning' },
              { type: 'text', text: 'Hello ' },
              { type: 'tool_use', id: 't', name: 'x', input: {} },
              { type: 'text', text: 'world' },
            ],
          })
        )
      );

      const result = await provider.chatComplete({
        model: 'claude-x',
        messages: [{ role: 'user', content: 'x' }],
      });

      // Reasoning blocks must not leak into the output.
      expect(result.content).toBe('Hello world');
    });

    it('maps the token counters onto the names callers persist', async () => {
      mockFetch.mockResolvedValue(
        reply(
          messageResponse({
            usage: {
              input_tokens: 20,
              output_tokens: 9,
              cache_read_input_tokens: 7,
            },
          })
        )
      );

      const { usage } = await provider.chatComplete({
        model: 'claude-x',
        messages: [{ role: 'user', content: 'x' }],
      });

      expect(usage).toEqual({
        promptTokens: 20,
        completionTokens: 9,
        // Anthropic reports no total; it has to be derived.
        totalTokens: 29,
        cachedTokens: 7,
      });
    });

    // Truncation guarantees malformed JSON downstream, so it must not pass
    // unnoticed.
    it('logs a truncated response', async () => {
      mockFetch.mockResolvedValue(
        reply(messageResponse({ stop_reason: 'max_tokens' }))
      );

      await provider.chatComplete({
        model: 'claude-x',
        messages: [{ role: 'user', content: 'x' }],
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('max_tokens'),
        expect.anything()
      );
    });

    it('rejects a payload with no content array', async () => {
      mockFetch.mockResolvedValue(reply({ id: 'msg', usage: {} }));

      await expect(
        provider.chatComplete({
          model: 'claude-x',
          messages: [{ role: 'user', content: 'x' }],
        })
      ).rejects.toMatchObject({ code: CODES.INVALID_RESPONSE });
    });
  });

  describe('error mapping', () => {
    it.each([
      [401, CODES.INVALID_CREDENTIALS],
      // permission_error: the key is not valid for this call, which is far
      // more actionable than a generic API error.
      [403, CODES.INVALID_CREDENTIALS],
      [429, CODES.QUOTA_EXCEEDED],
      [500, CODES.API_ERROR],
    ])('turns HTTP %s into %s', async (status, expected) => {
      mockFetch.mockResolvedValue(
        reply({ error: { message: 'nope' } }, status)
      );

      await expect(
        provider.chatComplete({
          model: 'claude-x',
          messages: [{ role: 'user', content: 'x' }],
        })
      ).rejects.toMatchObject({ code: expected });
    });
  });

  describe('model listing', () => {
    it('uses the display name as the label', async () => {
      mockFetch.mockResolvedValue(
        reply({
          data: [{ id: 'claude-x', display_name: 'Claude X' }],
        })
      );

      expect(await provider.listRemoteModels()).toEqual([
        { id: 'claude-x', label: 'Claude X' },
      ]);
    });
  });

  it('translates through the inherited path, with no JSON mode', async () => {
    expect(provider.supportsJsonResponseFormat()).toBe(false);
    mockFetch.mockResolvedValue(
      reply(
        messageResponse({
          content: [{ type: 'text', text: '{"a":"Hello"}' }],
        })
      )
    );

    const result = await provider.translateBatch({
      texts: { a: 'Bonjour' },
      sourceLanguage: 'fr',
      targetLanguage: 'en',
    });

    expect(result).toEqual({ a: 'Hello' });
  });
});
