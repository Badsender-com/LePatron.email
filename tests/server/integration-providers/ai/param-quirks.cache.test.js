'use strict';

const cache = require('../../../../packages/server/integration-providers/ai/param-quirks.cache');

const KEY = 'openai|https://api.openai.com|gpt-6-astra';
const RENAME = {
  param: 'max_tokens',
  action: 'rename',
  to: 'max_completion_tokens',
};
const DROP = { param: 'temperature', action: 'drop' };

describe('param-quirks cache', () => {
  beforeEach(() => {
    cache.clear();
    jest.restoreAllMocks();
  });

  // A missing entry means "nothing unusual known", never "checked and fine".
  it('knows nothing about a model it has not seen', () => {
    expect(cache.list(KEY)).toEqual([]);
  });

  it('gives back what it learned', () => {
    cache.add(KEY, RENAME);

    expect(cache.list(KEY)).toEqual([RENAME]);
  });

  // The translation path discovers two in sequence.
  it('accumulates quirks for the same model', () => {
    cache.add(KEY, RENAME);
    cache.add(KEY, DROP);

    expect(cache.list(KEY)).toEqual([RENAME, DROP]);
  });

  it('replaces rather than duplicates the same parameter', () => {
    cache.add(KEY, RENAME);
    cache.add(KEY, { param: 'max_tokens', action: 'drop' });

    const quirks = cache.list(KEY);
    expect(quirks).toHaveLength(1);
    expect(quirks[0].action).toBe('drop');
  });

  it('keeps models apart', () => {
    cache.add(KEY, RENAME);

    expect(cache.list('openai|https://api.openai.com|gpt-5-mini')).toEqual([]);
  });

  it('forgets an entry once it has expired', () => {
    cache.add(KEY, RENAME);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + cache.TTL_MS + 1000);

    expect(cache.list(KEY)).toEqual([]);
  });

  it('stays bounded', () => {
    for (let n = 0; n < cache.MAX_ENTRIES + 50; n += 1) {
      cache.add(`openai|https://api.openai.com|model-${n}`, RENAME);
    }

    // Still serving the most recent one, without growing without limit.
    expect(
      cache.list(
        `openai|https://api.openai.com|model-${cache.MAX_ENTRIES + 49}`
      )
    ).toEqual([RENAME]);
  });

  it('ignores a malformed quirk', () => {
    cache.add(KEY, null);
    cache.add(KEY, {});

    expect(cache.list(KEY)).toEqual([]);
  });
});
