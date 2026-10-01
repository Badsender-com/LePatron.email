'use strict';

const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);
jest.mock('../../../packages/server/utils/outbound-host.js', () => ({
  assertOutboundHostAllowed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  splitIntoBatches,
  translateInBatches,
  MAX_TRUNCATION_SPLIT_DEPTH,
} = require('../../../packages/server/translation/translation-batch.utils.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../../../packages/server/integration-providers/provider-error.js');
const OpenAIProvider = require('../../../packages/server/integration-providers/ai/openai-provider');

function textsOf(count) {
  const texts = {};
  for (let i = 0; i < count; i++) texts[`data.block.key${i}`] = `Text ${i}`;
  return texts;
}

const translated = (texts) =>
  Object.fromEntries(
    Object.entries(texts).map(([key, value]) => [key, `EN ${value}`])
  );

const truncation = () =>
  new ProviderError('response was truncated', CODES.OUTPUT_TRUNCATED);

describe('splitIntoBatches', () => {
  // The answer repeats every key: a batch measured on its values alone
  // answered at twice the size its limits allowed for (#1140).
  it('counts the keys in the size of a batch', () => {
    const longKey = `data.headerBlock.${'x'.repeat(80)}.alt`;
    const texts = { [`${longKey}1`]: 'Logo', [`${longKey}2`]: 'Logo' };

    const batches = splitIntoBatches(texts, { maxKeys: 100, maxChars: 150 });

    expect(batches).toHaveLength(2);
  });

  it('keeps entries together while they fit', () => {
    const batches = splitIntoBatches(textsOf(3), {
      maxKeys: 100,
      maxChars: 1000,
    });

    expect(batches).toEqual([textsOf(3)]);
  });

  it('still holds an entry larger than the limit, alone', () => {
    const texts = { a: 'x'.repeat(500), b: 'y' };

    const batches = splitIntoBatches(texts, { maxKeys: 100, maxChars: 100 });

    expect(batches).toEqual([{ a: texts.a }, { b: 'y' }]);
  });
});

describe('translateInBatches', () => {
  const params = { sourceLanguage: 'de', targetLanguage: 'en' };

  it('splits a truncated batch and translates every key', async () => {
    const batch = textsOf(80);
    const provider = {
      translateBatch: jest.fn(async ({ texts }) => {
        if (Object.keys(texts).length > 20) throw truncation();
        return translated(texts);
      }),
    };

    const result = await translateInBatches({
      provider,
      batches: [batch],
      ...params,
    });

    expect(result).toEqual(translated(batch));
    // 80 → 40 + 40 → four batches of 20, each answered in full.
    expect(provider.translateBatch).toHaveBeenCalledTimes(7);
  });

  it('reports progress once per batch, with all its keys', async () => {
    const onBatchProgress = jest.fn();
    const provider = {
      translateBatch: jest
        .fn()
        .mockRejectedValueOnce(truncation())
        .mockImplementation(async ({ texts }) => translated(texts)),
    };

    await translateInBatches({
      provider,
      batches: [textsOf(10)],
      onBatchProgress,
      ...params,
    });

    expect(onBatchProgress).toHaveBeenCalledTimes(1);
    expect(onBatchProgress).toHaveBeenCalledWith(1, 10);
  });

  it('passes the language pair and context on to each half', async () => {
    const provider = {
      translateBatch: jest
        .fn()
        .mockRejectedValueOnce(truncation())
        .mockImplementation(async ({ texts }) => translated(texts)),
    };

    await translateInBatches({
      provider,
      batches: [textsOf(4)],
      context: 'ctx',
      ...params,
    });

    expect(provider.translateBatch).toHaveBeenLastCalledWith({
      texts: { 'data.block.key2': 'Text 2', 'data.block.key3': 'Text 3' },
      sourceLanguage: 'de',
      targetLanguage: 'en',
      context: 'ctx',
    });
  });

  // A split batch is up to fifteen calls: a cancel must not wait for all.
  it('checks for a cancel before each half', async () => {
    const assertNotCancelled = jest
      .fn()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('TRANSLATION_CANCELLED'));
    const provider = {
      translateBatch: jest
        .fn()
        .mockRejectedValueOnce(truncation())
        .mockImplementation(async ({ texts }) => translated(texts)),
    };

    await expect(
      translateInBatches({
        provider,
        batches: [textsOf(4)],
        assertNotCancelled,
        ...params,
      })
    ).rejects.toThrow('TRANSLATION_CANCELLED');
    // The full batch, then the first half; the second never leaves.
    expect(provider.translateBatch).toHaveBeenCalledTimes(2);
  });

  it('stops splitting at the depth limit', async () => {
    const provider = {
      translateBatch: jest.fn().mockRejectedValue(truncation()),
    };

    await expect(
      translateInBatches({ provider, batches: [textsOf(64)], ...params })
    ).rejects.toMatchObject({ code: CODES.OUTPUT_TRUNCATED });
    // One call per level down the first branch, then the failure surfaces.
    expect(provider.translateBatch).toHaveBeenCalledTimes(
      MAX_TRUNCATION_SPLIT_DEPTH + 1
    );
  });

  it('fails a single key that does not fit', async () => {
    const provider = {
      translateBatch: jest.fn().mockRejectedValue(truncation()),
    };

    await expect(
      translateInBatches({ provider, batches: [textsOf(1)], ...params })
    ).rejects.toMatchObject({ code: CODES.OUTPUT_TRUNCATED });
    expect(provider.translateBatch).toHaveBeenCalledTimes(1);
  });

  // A refused key or a malformed answer would fail the same way on a smaller
  // batch: only truncation is worth splitting for.
  it('does not split on any other error', async () => {
    const provider = {
      translateBatch: jest
        .fn()
        .mockRejectedValue(
          new ProviderError('bad JSON', CODES.INVALID_RESPONSE)
        ),
    };

    await expect(
      translateInBatches({ provider, batches: [textsOf(10)], ...params })
    ).rejects.toMatchObject({ code: CODES.INVALID_RESPONSE });
    expect(provider.translateBatch).toHaveBeenCalledTimes(1);
  });
});

// The whole chain, from the provider's answer to the merged result: the
// truncation must survive the dialect, the chat call and the translation
// prompt to reach the batch loop.
describe('translateInBatches with a provider cutting its answer', () => {
  // Answers in full up to `maxKeys` keys, cut beyond, as an output token
  // ceiling would.
  function answerUpTo(maxKeys) {
    mockFetch.mockImplementation(async (url, { body }) => {
      const prompt = JSON.parse(body).messages[1].content;
      const input = JSON.parse(
        prompt.slice(
          prompt.indexOf('INPUT JSON:') + 11,
          prompt.indexOf('OUTPUT')
        )
      );
      const full = JSON.stringify(translated(input));
      const cut = Object.keys(input).length > maxKeys;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: { content: cut ? full.slice(0, 40) : full },
              finish_reason: cut ? 'length' : 'stop',
            },
          ],
        }),
      };
    });
  }

  beforeEach(() => mockFetch.mockReset());

  it('splits a batch answered with finish_reason length, and keeps every key', async () => {
    answerUpTo(30);
    const provider = new OpenAIProvider({
      provider: 'openai',
      apiKey: 'sk-test',
      config: {},
    });
    const batch = textsOf(80);

    const result = await translateInBatches({
      provider,
      batches: [batch],
      sourceLanguage: 'de',
      targetLanguage: 'en',
    });

    expect(result).toEqual(translated(batch));
    // 80 cut → 40 cut + 40 cut → four batches of 20.
    expect(mockFetch).toHaveBeenCalledTimes(7);
  });
});
