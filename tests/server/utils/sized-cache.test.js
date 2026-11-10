'use strict';

const {
  createSizedCache,
} = require('../../../packages/server/utils/sized-cache.js');

const lengthOf = (value) => value.length;

describe('createSizedCache', () => {
  it('keeps what it is given', () => {
    const cache = createSizedCache({ budget: 10, sizeOf: lengthOf });

    cache.set('a', 'abc');

    expect(cache.get('a')).toBe('abc');
    expect(cache.get('b')).toBeUndefined();
  });

  it('drops the entries read least recently past its budget', () => {
    const cache = createSizedCache({ budget: 6, sizeOf: lengthOf });
    cache.set('a', 'aaa');
    cache.set('b', 'bbb');
    cache.get('a');

    cache.set('c', 'ccc');

    expect(cache.get('a')).toBe('aaa');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe('ccc');
  });

  it('never keeps a value larger than an entry may be', () => {
    const cache = createSizedCache({
      budget: 10,
      maxEntry: 2,
      sizeOf: lengthOf,
    });

    cache.set('a', 'aaa');

    expect(cache.get('a')).toBeUndefined();
  });

  it('counts a value set again once', () => {
    const cache = createSizedCache({ budget: 6, sizeOf: lengthOf });
    cache.set('a', 'aaa');
    cache.set('a', 'aaa');

    cache.set('b', 'bbb');

    expect(cache.get('a')).toBe('aaa');
    expect(cache.get('b')).toBe('bbb');
  });

  it('forgets an entry once its time is over', () => {
    let at = 0;
    const cache = createSizedCache({
      budget: 10,
      ttlMs: 1000,
      sizeOf: lengthOf,
      now: () => at,
    });
    cache.set('a', 'aaa');

    at = 999;
    expect(cache.has('a')).toBe(true);
    at = 1000;
    expect(cache.get('a')).toBeUndefined();
  });
});
