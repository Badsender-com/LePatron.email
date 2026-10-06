'use strict';

jest.mock('../../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  callWithParamAdaptation,
  MAX_ATTEMPTS,
} = require('../../../../packages/server/integration-providers/ai/adaptive-chat-call');
const quirksCache = require('../../../../packages/server/integration-providers/ai/param-quirks.cache');
const {
  detectParamQuirk,
} = require('../../../../packages/server/integration-providers/ai/param-quirks');

const KEY = 'openai|https://api.openai.com|gpt-6-astra';

function refusal(param, code = 'unsupported_parameter') {
  return {
    ok: false,
    status: 400,
    parsedError: { error: { param, code } },
    message: `Unsupported parameter: '${param}'`,
  };
}

function run(performAttempt, overrides = {}) {
  return callWithParamAdaptation({
    performAttempt,
    body: { model: 'gpt-6-astra', max_tokens: 1024, temperature: 0.3 },
    detect: detectParamQuirk,
    key: KEY,
    deadlineAt: Date.now() + 300000,
    label: 'openai/gpt-6-astra',
    ...overrides,
  });
}

describe('callWithParamAdaptation', () => {
  beforeEach(() => {
    quirksCache.clear();
    jest.clearAllMocks();
  });

  it('returns straight away when nothing is refused', async () => {
    const attempt = jest
      .fn()
      .mockResolvedValue({ ok: true, data: { fine: true } });

    const result = await run(attempt);

    expect(result.data).toEqual({ fine: true });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('renames the refused parameter and replays', async () => {
    const attempt = jest
      .fn()
      .mockResolvedValueOnce(refusal('max_tokens'))
      .mockResolvedValueOnce({ ok: true, data: { fine: true } });

    const result = await run(attempt);

    expect(result.data).toEqual({ fine: true });
    const secondBody = attempt.mock.calls[1][0];
    expect(secondBody.max_completion_tokens).toBe(1024);
    expect(secondBody.max_tokens).toBeUndefined();
  });

  // The case that made one replay insufficient: translation always sends a
  // temperature, so gpt-6-astra is refused twice in a row.
  it('survives two refusals in a row', async () => {
    const attempt = jest
      .fn()
      .mockResolvedValueOnce(refusal('max_tokens'))
      .mockResolvedValueOnce(refusal('temperature', 'unsupported_value'))
      .mockResolvedValueOnce({ ok: true, data: { fine: true } });

    const result = await run(attempt);

    expect(result.data).toEqual({ fine: true });
    expect(attempt).toHaveBeenCalledTimes(3);
    const lastBody = attempt.mock.calls[2][0];
    expect(lastBody.max_completion_tokens).toBe(1024);
    expect(lastBody.temperature).toBeUndefined();
  });

  // Termination is structural: the same parameter is never adapted twice.
  it('gives up when the provider keeps refusing what was already fixed', async () => {
    const attempt = jest
      .fn()
      .mockResolvedValue(refusal('temperature', 'unsupported_value'));

    const result = await run(attempt);

    expect(result.failure).toBeTruthy();
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('never exceeds its attempt budget', async () => {
    const attempt = jest
      .fn()
      .mockResolvedValueOnce(refusal('max_tokens'))
      .mockResolvedValueOnce(refusal('temperature', 'unsupported_value'))
      .mockResolvedValueOnce(refusal('reasoning_effort'))
      .mockResolvedValue({ ok: true, data: {} });

    await run(attempt);

    expect(attempt).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  // The safety property: only a parameter refusal is ever replayed.
  it.each([
    [
      'unauthorized',
      {
        ok: false,
        status: 401,
        parsedError: { error: { code: 'invalid_api_key' } },
        message: 'bad key',
      },
    ],
    [
      'rate limited',
      { ok: false, status: 429, parsedError: {}, message: 'slow down' },
    ],
    [
      'server error',
      { ok: false, status: 500, parsedError: {}, message: 'boom' },
    ],
    ['an unknown parameter', refusal('messages')],
  ])('does not replay on %s', async (_label, failure) => {
    const attempt = jest.fn().mockResolvedValue(failure);

    const result = await run(attempt);

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(result.failure).toBe(failure);
  });

  it('hands back the last refusal untouched', async () => {
    const last = refusal('temperature', 'unsupported_value');
    const attempt = jest
      .fn()
      .mockResolvedValueOnce(refusal('max_tokens'))
      .mockResolvedValue(last);

    const result = await run(attempt);

    expect(result.failure).toBe(last);
  });

  describe('memory', () => {
    it('applies what it already learned, without paying the refusal again', async () => {
      quirksCache.add(KEY, {
        param: 'max_tokens',
        action: 'rename',
        to: 'max_completion_tokens',
      });
      const attempt = jest.fn().mockResolvedValue({ ok: true, data: {} });

      await run(attempt);

      expect(attempt).toHaveBeenCalledTimes(1);
      expect(attempt.mock.calls[0][0].max_completion_tokens).toBe(1024);
    });

    it('remembers what it discovers', async () => {
      const attempt = jest
        .fn()
        .mockResolvedValueOnce(refusal('max_tokens'))
        .mockResolvedValueOnce({ ok: true, data: {} });

      await run(attempt);

      expect(quirksCache.list(KEY)).toEqual([
        { param: 'max_tokens', action: 'rename', to: 'max_completion_tokens' },
      ]);
    });

    it('remembers nothing when the call simply works', async () => {
      await run(jest.fn().mockResolvedValue({ ok: true, data: {} }));

      expect(quirksCache.list(KEY)).toEqual([]);
    });

    // A refusal that belongs to this request, not to the model.
    it('adapts but does not remember a transient quirk', async () => {
      const attempt = jest
        .fn()
        .mockResolvedValueOnce(refusal('temperature'))
        .mockResolvedValueOnce({ ok: true, data: {} });
      const detect = (...args) => ({
        ...detectParamQuirk(...args),
        transient: true,
      });

      await run(attempt, { detect });

      expect(attempt.mock.calls[1][0]).not.toHaveProperty('temperature');
      expect(quirksCache.list(KEY)).toEqual([]);
    });
  });

  // Anthropic's JSON-mode fallbacks replace a parameter by another route,
  // which a drop or a rename cannot express.
  describe('custom adaptation', () => {
    const swap = (body, quirks) =>
      quirks.reduce(
        (current, quirk) => ({ ...current, swapped: quirk.param }),
        body
      );

    it('applies a fresh quirk through the dialect', async () => {
      const attempt = jest
        .fn()
        .mockResolvedValueOnce(refusal('max_tokens'))
        .mockResolvedValueOnce({ ok: true, data: {} });

      const { body } = await run(attempt, { apply: swap });

      expect(body.swapped).toBe('max_tokens');
      expect(attempt.mock.calls[1][0].swapped).toBe('max_tokens');
    });

    // Every quirk so far, on the original body: the dialect decides the
    // order, not the order they were learned in.
    it('hands the dialect every quirk on the original body', async () => {
      quirksCache.add(KEY, { param: 'temperature', action: 'drop' });
      const apply = jest.fn((body) => body);
      const attempt = jest
        .fn()
        .mockResolvedValueOnce(refusal('max_tokens'))
        .mockResolvedValueOnce({ ok: true, data: {} });

      await run(attempt, { apply });

      const [body, quirks] = apply.mock.calls[1];
      expect(body).toHaveProperty('temperature', 0.3);
      expect(quirks.map((quirk) => quirk.param)).toEqual([
        'temperature',
        'max_tokens',
      ]);
    });

    it('applies the remembered quirks through the dialect', async () => {
      quirksCache.add(KEY, { param: 'temperature', action: 'drop' });
      const attempt = jest.fn().mockResolvedValue({ ok: true, data: {} });

      await run(attempt, { apply: swap });

      expect(attempt.mock.calls[0][0].swapped).toBe('temperature');
    });
  });

  // Three attempts must not mean three times the timeout.
  describe('time budget', () => {
    it('shrinks the budget as attempts are spent', async () => {
      const attempt = jest
        .fn()
        .mockResolvedValueOnce(refusal('max_tokens'))
        .mockResolvedValueOnce({ ok: true, data: {} });

      await run(attempt, { deadlineAt: Date.now() + 10000 });

      expect(attempt.mock.calls[1][1]).toBeLessThanOrEqual(
        attempt.mock.calls[0][1]
      );
    });

    it('never hands down a zero or negative budget', async () => {
      const attempt = jest
        .fn()
        .mockResolvedValueOnce(refusal('max_tokens'))
        .mockResolvedValueOnce({ ok: true, data: {} });

      await run(attempt, { deadlineAt: Date.now() - 5000 });

      for (const call of attempt.mock.calls) {
        expect(call[1]).toBeGreaterThan(0);
      }
    });
  });
});
