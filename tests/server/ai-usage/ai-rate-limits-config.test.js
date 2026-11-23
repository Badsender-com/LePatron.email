'use strict';

const {
  parseAiRateLimits,
} = require('../../../packages/server/ai-usage/ai-rate-limits-config.js');

describe('parseAiRateLimits', () => {
  it('reads the limits an environment variable gives as strings', () => {
    expect(
      parseAiRateLimits({
        perUserPerMinute: '50',
        perUserPerDay: '400',
        perGroupPerDay: '5000',
      })
    ).toEqual({
      perUserPerMinute: 50,
      perUserPerDay: 400,
      perGroupPerDay: 5000,
    });
  });

  it('keeps the limits the config gives as numbers', () => {
    expect(parseAiRateLimits({ perUserPerMinute: 20 })).toEqual({
      perUserPerMinute: 20,
    });
  });

  it('leaves an unset limit unset', () => {
    expect(parseAiRateLimits({})).toEqual({});
    expect(parseAiRateLimits()).toEqual({});
  });

  it.each([['abc'], [''], ['0'], ['-5'], [0], ['Infinity'], [true]])(
    'refuses to start on %p, naming the variable',
    (value) => {
      expect(() => parseAiRateLimits({ perGroupPerDay: value })).toThrow(
        'lepatron_aiRateLimits__perGroupPerDay'
      );
    }
  );
});
