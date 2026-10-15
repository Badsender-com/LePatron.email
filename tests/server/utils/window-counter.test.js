'use strict';

const {
  windowCounter,
} = require('../../../packages/server/utils/window-counter.js');

describe('windowCounter', () => {
  it('allows `limit` hits per key within the window, then refuses', () => {
    const counter = windowCounter({ windowMs: 1000, limit: 2 });
    expect(counter.hit('a', 0)).toBe(true);
    expect(counter.hit('a', 10)).toBe(true);
    expect(counter.hit('a', 20)).toBe(false);
    // Another key has its own count.
    expect(counter.hit('b', 20)).toBe(true);
  });

  it('lets a hit through once the oldest one leaves the window', () => {
    const counter = windowCounter({ windowMs: 1000, limit: 2 });
    counter.hit('a', 0);
    counter.hit('a', 500);
    expect(counter.hit('a', 999)).toBe(false);
    expect(counter.hit('a', 1000)).toBe(true);
    // The window slides: the hits at 500 and 1000 still count.
    expect(counter.hit('a', 1001)).toBe(false);
  });

  it('forgets keys whose hits have all expired', () => {
    const counter = windowCounter({ windowMs: 1000, limit: 5 });
    counter.hit('a', 0);
    counter.hit('b', 0);
    expect(counter.size()).toBe(2);
    counter.hit('c', 2000);
    expect(counter.size()).toBe(1);
  });

  it('walks every key at most once per purge interval, the key hit always fresh', () => {
    const counter = windowCounter({
      windowMs: 1000,
      limit: 1,
      purgeEveryMs: 500,
    });
    counter.hit('a', 0);
    counter.hit('b', 600);
    // `a` expired at 1000, but the last walk was at 600: it is still kept.
    expect(counter.hit('c', 1050)).toBe(true);
    expect(counter.size()).toBe(3);
    // Its own hits are read fresh all the same.
    expect(counter.hit('a', 1060)).toBe(true);
    // The next walk, past the interval, drops what expired.
    counter.hit('d', 1700);
    expect(counter.size()).toBe(3);
    counter.hit('d', 2700);
    expect(counter.size()).toBe(1);
  });

  it('does not record a refused hit', () => {
    const counter = windowCounter({ windowMs: 1000, limit: 1 });
    counter.hit('a', 0);
    counter.hit('a', 100);
    counter.hit('a', 200);
    // Only the first hit counts: at 1001 the key is free again.
    expect(counter.hit('a', 1001)).toBe(true);
  });
});
