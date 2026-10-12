'use strict';

const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);
jest.mock('../../../../packages/server/utils/outbound-host.js', () => ({
  assertOutboundHostAllowed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const AnthropicProvider = require('../../../../packages/server/integration-providers/ai/anthropic-provider');
const quirksCache = require('../../../../packages/server/integration-providers/ai/param-quirks.cache.js');
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

function sentBody(call = 0) {
  return JSON.parse(mockFetch.mock.calls[call][1].body);
}
function sentHeaders() {
  return mockFetch.mock.calls[0][1].headers;
}

describe('AnthropicProvider', () => {
  let provider;

  beforeEach(() => {
    jest.clearAllMocks();
    // Learned quirks are per process: one test's refusal must not shape the
    // next test's request.
    quirksCache.clear();
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
    // tried and is refused by generation 5.
    describe('JSON mode', () => {
      // The shape of the text generation output: zod emits minLength,
      // minItems and maxItems, which structured outputs refuses.
      const proposalsSchema = {
        type: 'object',
        properties: {
          proposals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string', minLength: 1 },
                angle: { type: 'string', minLength: 1 },
              },
              required: ['text', 'angle'],
              additionalProperties: false,
            },
            minItems: 3,
            maxItems: 3,
          },
        },
        required: ['proposals'],
        additionalProperties: false,
      };
      const proposals = {
        proposals: [
          { text: 'Un', angle: 'a' },
          { text: 'Deux', angle: 'b' },
          { text: 'Trois', angle: 'c' },
        ],
      };

      function askJson(schema, model = 'claude-x') {
        return provider.chatComplete({
          model,
          messages: [
            { role: 'system', content: 'be terse' },
            { role: 'user', content: 'x' },
          ],
          responseFormat: { type: 'json_object', schema },
        });
      }

      function toolAnswer(input) {
        return reply(
          messageResponse({
            content: [{ type: 'tool_use', id: 't1', name: 'emit_json', input }],
            stop_reason: 'tool_use',
          })
        );
      }

      function textAnswer(text) {
        return reply(messageResponse({ content: [{ type: 'text', text }] }));
      }

      function refused(message) {
        return reply(
          {
            type: 'error',
            error: { type: 'invalid_request_error', message },
          },
          400
        );
      }

      const FORCED_TOOL_REFUSAL =
        'tool_choice: type "tool" and "any" are not supported for this model.';

      describe('structured outputs, when a schema is supplied', () => {
        // Decoded against the schema, the answer cannot come back wrapped in
        // an invented key, as claude-opus-5 did under the forced tool.
        it('asks for a JSON schema format rather than a tool call', async () => {
          mockFetch.mockResolvedValue(textAnswer(JSON.stringify(proposals)));

          await askJson(proposalsSchema);

          expect(sentBody().output_config.format.type).toBe('json_schema');
          expect(sentBody().tools).toBeUndefined();
          expect(sentBody().tool_choice).toBeUndefined();
        });

        // Sent as is, they are a 400. The zod schema still checks them once
        // the answer is in.
        it('strips the constraints structured outputs refuses', async () => {
          mockFetch.mockResolvedValue(textAnswer(JSON.stringify(proposals)));

          await askJson(proposalsSchema);

          const { schema } = sentBody().output_config.format;
          expect(schema.properties.proposals).toEqual({
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                angle: { type: 'string' },
              },
              required: ['text', 'angle'],
              additionalProperties: false,
            },
          });
        });

        it('closes every object, as structured outputs requires', async () => {
          mockFetch.mockResolvedValue(textAnswer('{"text":"x"}'));

          await askJson({
            type: 'object',
            properties: { text: { type: 'string' } },
            required: ['text'],
          });

          expect(
            sentBody().output_config.format.schema.additionalProperties
          ).toBe(false);
        });

        // Walked by structure, not by key name.
        it('keeps a property that happens to be named like a keyword', async () => {
          mockFetch.mockResolvedValue(textAnswer('{"minLength":"x"}'));

          await askJson({
            type: 'object',
            properties: { minLength: { type: 'string' } },
            required: ['minLength'],
          });

          expect(
            sentBody().output_config.format.schema.properties.minLength
          ).toEqual({ type: 'string' });
        });

        // null is a value a keyword may hold, not a schema that failed.
        it('keeps a keyword whose value is null', async () => {
          mockFetch.mockResolvedValue(textAnswer('{"text":null}'));

          await askJson({
            type: 'object',
            properties: { text: { const: null } },
            required: ['text'],
          });

          expect(
            sentBody().output_config.format.schema.properties.text
          ).toEqual({ const: null });
        });

        // zod's email pattern carries lookaheads, which structured outputs
        // refuses; zod checks the pattern after the call.
        it('strips patterns', async () => {
          mockFetch.mockResolvedValue(textAnswer('{"email":"a@b.c"}'));

          await askJson({
            type: 'object',
            properties: {
              email: { type: 'string', pattern: '^(?!\\.)[^@]+@[^@]+$' },
              pattern: { type: 'string' },
            },
            required: ['email'],
          });

          expect(sentBody().output_config.format.schema.properties).toEqual({
            email: { type: 'string' },
            pattern: { type: 'string' },
          });
        });

        // What zod emits for a discriminated union.
        it('turns oneOf into anyOf', async () => {
          const branch = (kind) => ({
            type: 'object',
            properties: { kind: { const: kind } },
            required: ['kind'],
          });
          mockFetch.mockResolvedValue(textAnswer('{"block":{"kind":"a"}}'));

          await askJson({
            type: 'object',
            properties: { block: { oneOf: [branch('a'), branch('b')] } },
            required: ['block'],
          });

          const { block } = sentBody().output_config.format.schema.properties;
          expect(block.oneOf).toBeUndefined();
          expect(block.anyOf).toHaveLength(2);
          expect(block.anyOf[0].additionalProperties).toBe(false);
        });

        // An open map has no equivalent there: closing it would forbid every
        // key. The tool takes it as is.
        it('uses the tool for a schema it cannot express', async () => {
          const schema = {
            type: 'object',
            properties: {
              labels: {
                type: 'object',
                additionalProperties: { type: 'string' },
              },
            },
          };
          mockFetch.mockResolvedValue(toolAnswer({ labels: { a: 'b' } }));

          await askJson(schema);

          expect(sentBody().output_config).toBeUndefined();
          expect(sentBody().tools[0].input_schema).toEqual(schema);
        });

        it('reads the answer from the text block', async () => {
          mockFetch.mockResolvedValue(textAnswer(JSON.stringify(proposals)));

          const result = await askJson(proposalsSchema);

          expect(JSON.parse(result.content)).toEqual(proposals);
        });
      });

      describe('forced tool, when no schema is usable', () => {
        it('forces the tool with an open object when no schema is sent', async () => {
          mockFetch.mockResolvedValue(toolAnswer({ text: 'Bonjour' }));

          await askJson(undefined);

          expect(sentBody().tool_choice).toEqual({
            type: 'tool',
            name: 'emit_json',
          });
          expect(sentBody().tools[0].input_schema).toEqual({ type: 'object' });
        });

        // Anthropic answers 400 to any input_schema that is not an object.
        it('falls back to an open object for a schema of another shape', async () => {
          mockFetch.mockResolvedValue(toolAnswer({ text: 'Bonjour' }));

          await askJson({ type: 'array', items: { type: 'string' } });

          expect(sentBody().output_config).toBeUndefined();
          expect(sentBody().tools[0].input_schema).toEqual({ type: 'object' });
        });

        // The tool input arrives parsed; callers expect a JSON string.
        it('re-serialises the tool input as the content', async () => {
          mockFetch.mockResolvedValue(toolAnswer({ text: 'Bonjour' }));

          const result = await askJson(undefined);

          expect(JSON.parse(result.content)).toEqual({ text: 'Bonjour' });
        });
      });

      it('declares no tool and no format when no JSON is asked for', async () => {
        mockFetch.mockResolvedValue(reply(messageResponse()));

        await provider.chatComplete({
          model: 'claude-x',
          messages: [{ role: 'user', content: 'x' }],
        });

        expect(sentBody().tools).toBeUndefined();
        expect(sentBody().tool_choice).toBeUndefined();
        expect(sentBody().output_config).toBeUndefined();
      });

      it('still reads a plain text answer when no tool was used', async () => {
        mockFetch.mockResolvedValue(reply(messageResponse()));

        const result = await provider.chatComplete({
          model: 'claude-x',
          messages: [{ role: 'user', content: 'x' }],
        });

        expect(result.content).toBe('bonjour');
      });

      // Each fallback is learned from the refusal and remembered, like the
      // other providers' parameter quirks.
      describe('fallbacks', () => {
        // 2026-10-06 golden runs: claude-opus-5-5 refused every skill call.
        it('lets the model choose the tool when a forced choice is refused', async () => {
          mockFetch
            .mockResolvedValueOnce(refused(FORCED_TOOL_REFUSAL))
            .mockResolvedValueOnce(toolAnswer({ text: 'Bonjour' }));

          const result = await askJson(undefined, 'claude-opus-5-5');

          expect(mockFetch).toHaveBeenCalledTimes(2);
          expect(sentBody(1).tool_choice).toEqual({ type: 'auto' });
          expect(sentBody(1).tools[0].name).toBe('emit_json');
          // Nothing forces the call any more: the prompt has to ask for it.
          expect(sentBody(1).system).toMatch(/^be terse\n\n.*emit_json/);
          expect(JSON.parse(result.content)).toEqual({ text: 'Bonjour' });
        });

        // `auto` guarantees no call: an answer in prose must still come
        // through, for the caller's parser to read.
        it('reads a text answer when the model skipped the tool', async () => {
          mockFetch
            .mockResolvedValueOnce(refused(FORCED_TOOL_REFUSAL))
            .mockResolvedValueOnce(textAnswer('{"text":"Bonjour"}'));

          const result = await askJson(undefined, 'claude-opus-5-5');

          expect(JSON.parse(result.content)).toEqual({ text: 'Bonjour' });
        });

        it('pays the refusal once per model, not once per call', async () => {
          mockFetch
            .mockResolvedValueOnce(refused(FORCED_TOOL_REFUSAL))
            .mockResolvedValue(toolAnswer({ text: 'Bonjour' }));

          await askJson(undefined, 'claude-opus-5-5');
          await askJson(undefined, 'claude-opus-5-5');

          expect(mockFetch).toHaveBeenCalledTimes(3);
          expect(sentBody(2).tool_choice).toEqual({ type: 'auto' });
        });

        // An older model, or a gateway that does not know the field.
        it('moves to the forced tool when output_config is refused', async () => {
          mockFetch
            .mockResolvedValueOnce(
              refused('output_config: Extra inputs are not permitted')
            )
            .mockResolvedValueOnce(toolAnswer(proposals));

          const result = await askJson(proposalsSchema, 'claude-legacy');

          expect(mockFetch).toHaveBeenCalledTimes(2);
          expect(sentBody(1).output_config).toBeUndefined();
          expect(sentBody(1).tool_choice).toEqual({
            type: 'tool',
            name: 'emit_json',
          });
          expect(sentBody(1).tools[0].input_schema.properties).toHaveProperty(
            'proposals'
          );
          expect(JSON.parse(result.content)).toEqual(proposals);
        });

        it('goes down both steps for a model refusing both routes', async () => {
          mockFetch
            .mockResolvedValueOnce(
              refused('output_config.format: not supported for this model')
            )
            .mockResolvedValueOnce(refused(FORCED_TOOL_REFUSAL))
            .mockResolvedValueOnce(toolAnswer(proposals));

          await askJson(proposalsSchema, 'claude-both');
          await askJson(proposalsSchema, 'claude-both');

          expect(mockFetch).toHaveBeenCalledTimes(4);
          expect(sentBody(2).tool_choice).toEqual({ type: 'auto' });
          // Remembered: the next call starts at the end.
          expect(sentBody(3).output_config).toBeUndefined();
          expect(sentBody(3).tool_choice).toEqual({ type: 'auto' });
        });

        // A skill without schema refuses the forced choice first; the next
        // one, with a schema, must not get the forced tool back once
        // output_config is refused.
        it('lands on auto whichever refusal came first', async () => {
          mockFetch
            .mockResolvedValueOnce(refused(FORCED_TOOL_REFUSAL))
            .mockResolvedValueOnce(toolAnswer({ text: 'x' }))
            .mockResolvedValueOnce(refused('output_config: not supported'))
            .mockResolvedValue(toolAnswer(proposals));

          await askJson(undefined, 'claude-both');
          const result = await askJson(proposalsSchema, 'claude-both');
          await askJson(proposalsSchema, 'claude-both');

          expect(mockFetch).toHaveBeenCalledTimes(5);
          for (const call of [3, 4]) {
            expect(sentBody(call).output_config).toBeUndefined();
            expect(sentBody(call).tool_choice).toEqual({ type: 'auto' });
          }
          expect(JSON.parse(result.content)).toEqual(proposals);
        });

        // The wording has not been observed live: the feature's name is
        // enough, not only the field's.
        it('recognises a refusal naming structured outputs', async () => {
          mockFetch
            .mockResolvedValueOnce(
              refused('This model does not support structured outputs.')
            )
            .mockResolvedValueOnce(toolAnswer(proposals));

          await askJson(proposalsSchema, 'claude-legacy');

          expect(sentBody(1).output_config).toBeUndefined();
          expect(sentBody(1).tools[0].name).toBe('emit_json');
        });

        // One skill's schema says nothing about the model: the others keep
        // structured outputs.
        it('falls back for this request only when the schema is refused', async () => {
          mockFetch
            .mockResolvedValueOnce(
              refused('output_config.format.schema: lookaround not supported')
            )
            .mockResolvedValueOnce(toolAnswer(proposals))
            .mockResolvedValue(textAnswer(JSON.stringify(proposals)));

          const result = await askJson(proposalsSchema);
          await askJson(proposalsSchema);

          expect(sentBody(1).output_config).toBeUndefined();
          expect(JSON.parse(result.content)).toEqual(proposals);
          expect(sentBody(2).output_config.format.type).toBe('json_schema');
          expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('this request only')
          );
        });

        // A genuine misconfiguration must surface, not be retried into
        // something else.
        it('raises any other refusal untouched', async () => {
          mockFetch.mockResolvedValue(refused('model: claude-nope not found'));

          await expect(askJson(proposalsSchema)).rejects.toThrow(
            /claude-nope not found/
          );
          expect(mockFetch).toHaveBeenCalledTimes(1);
        });
      });

      // 2026-10-06 golden runs: claude-opus-5 wrapped the tool input in an
      // invented key in 12 calls out of 21, a different one each time, and
      // every one failed the strict zod schema.
      describe('invented envelope', () => {
        const legacy = 'claude-legacy';

        async function answerThroughTool(input) {
          mockFetch
            .mockResolvedValueOnce(refused('output_config: not supported'))
            .mockResolvedValueOnce(toolAnswer(input));
          return askJson(proposalsSchema, legacy);
        }

        it.each(['paramètre', 'angle', 'paramètre_manquant', 'parameters'])(
          'unwraps an answer nested under "%s"',
          async (key) => {
            const result = await answerThroughTool({ [key]: proposals });

            expect(JSON.parse(result.content)).toEqual(proposals);
            expect(logger.warn).toHaveBeenCalledWith(
              expect.stringContaining(`"${key}"`)
            );
          }
        );

        it('unwraps an envelope holding the JSON as text', async () => {
          const result = await answerThroughTool({
            paramètre: JSON.stringify(proposals),
          });

          expect(JSON.parse(result.content)).toEqual(proposals);
        });

        it('unwraps a text answer too', async () => {
          mockFetch.mockResolvedValue(
            textAnswer(JSON.stringify({ réponse: proposals }))
          );

          const result = await askJson(proposalsSchema);

          expect(JSON.parse(result.content)).toEqual(proposals);
        });

        // Anything else is the zod schema's to judge, not ours to reshape.
        it.each([
          ['a key the schema knows', { proposals: { proposals: [] } }],
          ['more than one key', { a: proposals, b: proposals }],
          ['a value missing a required key', { paramètre: { other: 1 } }],
          [
            'a value with keys the schema does not know',
            { paramètre: { ...proposals, extra: true } },
          ],
          ['a value that is not an object', { paramètre: [1, 2, 3] }],
        ])('leaves alone %s', async (label, input) => {
          const result = await answerThroughTool(input);

          expect(JSON.parse(result.content)).toEqual(input);
        });

        it('leaves alone text that is not JSON, for the repair pass', async () => {
          mockFetch.mockResolvedValue(textAnswer('Voici : {"proposals": []}'));

          const result = await askJson(proposalsSchema);

          expect(result.content).toBe('Voici : {"proposals": []}');
        });

        // Structured outputs cannot answer prose: a proxy silently dropping
        // output_config can, and nothing else would say so.
        it('warns when prose comes back for a structured output', async () => {
          mockFetch.mockResolvedValue(textAnswer('Voici trois idées.'));

          await askJson(proposalsSchema);

          expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('output_config may not reach the API')
          );
        });

        it('leaves alone an empty object under a schema with nothing required', async () => {
          mockFetch.mockResolvedValue(textAnswer('{"anything":{}}'));

          const result = await askJson({
            type: 'object',
            properties: { text: { type: 'string' } },
          });

          expect(JSON.parse(result.content)).toEqual({ anything: {} });
        });

        it('leaves an answer alone when no schema was sent', async () => {
          mockFetch.mockResolvedValue(toolAnswer({ paramètre: { text: 'x' } }));

          const result = await askJson(undefined);

          expect(JSON.parse(result.content)).toEqual({
            paramètre: { text: 'x' },
          });
        });
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

      // A generation we do not know yet loses temperature rather than failing
      // every translation call on it.
      it.each(['claude-opus-5-5', 'claude-sonnet-6', 'claude-future'])(
        'omits it on %s',
        async (model) => {
          mockFetch.mockResolvedValue(reply(messageResponse()));

          await provider.chatComplete({
            model,
            messages: [{ role: 'user', content: 'x' }],
            temperature: 0.3,
          });

          expect(sentBody().temperature).toBeUndefined();
        }
      );

      // claude-haiku-4-5 and claude-3-5-sonnet have a 5 in their id but are
      // 4.x and 3.x models: they take one.
      it.each([
        'claude-haiku-4-5-20251001',
        'claude-sonnet-4-5-20250929',
        'claude-opus-4-1-20250805',
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
      ])('keeps it on %s', async (model) => {
        mockFetch.mockResolvedValue(reply(messageResponse()));

        await provider.chatComplete({
          model,
          messages: [{ role: 'user', content: 'x' }],
          temperature: 0.3,
        });

        expect(sentBody().temperature).toBe(0.3);
      });
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
    // unnoticed. Reported to the base class, which logs it for every dialect.
    it('reports truncation as a length finish', () => {
      expect(provider._getFinishReason({ stop_reason: 'max_tokens' })).toBe(
        'length'
      );
      expect(provider._getFinishReason({ stop_reason: 'end_turn' })).toBeNull();
    });

    // Staging, #1140: a 30 000-character batch came back cut at 8192 tokens
    // and failed as "Unexpected end of JSON input".
    it('types a cut translation as truncation, not as a parse error', async () => {
      mockFetch.mockResolvedValue(
        reply(
          messageResponse({
            content: [{ type: 'text', text: '{"a": "Hel' }],
            stop_reason: 'max_tokens',
          })
        )
      );

      await expect(
        provider.translateBatch({
          texts: { a: 'Hallo', b: 'Welt' },
          sourceLanguage: 'de',
          targetLanguage: 'en',
        })
      ).rejects.toMatchObject({ code: CODES.OUTPUT_TRUNCATED });
    });

    // A skill answering in prose can still use a cut answer: reported, not
    // thrown.
    it('reports a cut chat answer on the result', async () => {
      mockFetch.mockResolvedValue(
        reply(messageResponse({ stop_reason: 'max_tokens' }))
      );

      const result = await provider.chatComplete({
        model: 'claude-x',
        messages: [{ role: 'user', content: 'x' }],
      });

      expect(result).toMatchObject({ content: 'bonjour', truncated: true });
    });

    // Found by the conformance script: claude-fable-5 declines the translation
    // prompt outright. Reported as an empty response, it read as a parser bug.
    it('names a refusal rather than calling it an empty response', async () => {
      mockFetch.mockResolvedValue(
        reply(messageResponse({ content: [], stop_reason: 'refusal' }))
      );

      await expect(
        provider.chatComplete({
          model: 'claude-x',
          messages: [{ role: 'user', content: 'x' }],
        })
      ).rejects.toThrow(/declined/i);
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
