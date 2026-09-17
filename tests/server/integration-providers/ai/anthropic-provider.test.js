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

    // There is no response_format on this endpoint, and an instruction alone
    // does not hold: a skill whose prompt asked for "du texte simple" got
    // prose back and failed at OUTPUT_PARSE. Prefilling an assistant turn was
    // tried and is refused by generation 5, so a forced tool call is what
    // holds the format on both generations.
    describe('forced JSON', () => {
      it('forces a tool call when JSON is asked for', async () => {
        mockFetch.mockResolvedValue(reply(messageResponse()));

        await provider.chatComplete({
          model: 'claude-x',
          messages: [{ role: 'user', content: 'x' }],
          responseFormat: { type: 'json_object' },
        });

        expect(sentBody().tool_choice).toEqual({
          type: 'tool',
          name: 'emit_json',
        });
        // Left open on purpose: the real schema is in the output contract
        // already injected into the prompt, out of this class's reach.
        expect(sentBody().tools[0].input_schema).toEqual({ type: 'object' });
      });

      it('declares no tool when no JSON is asked for', async () => {
        mockFetch.mockResolvedValue(reply(messageResponse()));

        await provider.chatComplete({
          model: 'claude-x',
          messages: [{ role: 'user', content: 'x' }],
        });

        expect(sentBody().tools).toBeUndefined();
        expect(sentBody().tool_choice).toBeUndefined();
      });

      // The tool input arrives parsed; callers expect a JSON string.
      it('re-serialises the tool input as the content', async () => {
        mockFetch.mockResolvedValue(
          reply(
            messageResponse({
              content: [
                {
                  type: 'tool_use',
                  id: 't1',
                  name: 'emit_json',
                  input: { text: 'Bonjour' },
                },
              ],
            })
          )
        );

        const result = await provider.chatComplete({
          model: 'claude-x',
          messages: [{ role: 'user', content: 'x' }],
          responseFormat: { type: 'json_object' },
        });

        expect(JSON.parse(result.content)).toEqual({ text: 'Bonjour' });
      });

      it('still reads a plain text answer when no tool was used', async () => {
        mockFetch.mockResolvedValue(reply(messageResponse()));

        const result = await provider.chatComplete({
          model: 'claude-x',
          messages: [{ role: 'user', content: 'x' }],
        });

        expect(result.content).toBe('bonjour');
      });
    });

    // Generation 5 dropped temperature and answers 400 when it is sent.
    describe('temperature', () => {
      it('omits it on generation 5', async () => {
        mockFetch.mockResolvedValue(reply(messageResponse()));

        await provider.chatComplete({
          model: 'claude-sonnet-5',
          messages: [{ role: 'user', content: 'x' }],
          temperature: 0.3,
        });

        expect(sentBody().temperature).toBeUndefined();
      });

      // claude-haiku-4-5 has a 5 in its id but is a 4.x model: it takes one.
      it.each(['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929'])(
        'keeps it on %s',
        async (model) => {
          mockFetch.mockResolvedValue(reply(messageResponse()));

          await provider.chatComplete({
            model,
            messages: [{ role: 'user', content: 'x' }],
            temperature: 0.3,
          });

          expect(sentBody().temperature).toBe(0.3);
        }
      );
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

  // Translation does not go through the prefill: it sets no responseFormat,
  // relying on the prompt and the fence-stripping parser instead.
  it('translates through the inherited path', async () => {
    expect(provider._supportsResponseFormat()).toBe(false);
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
