'use strict';

// The views of the public page, per reader of a link and per link, per
// window: tables bounded without ever being reset as a whole.

const {
  createShareViewLimiter,
} = require('../../../packages/server/share-link/share-view-limiter.js');

const WINDOW_MS = 60 * 1000;
const T0 = 1_000_000;

function makeLimiter(options = {}) {
  return createShareViewLimiter({
    windowMs: WINDOW_MS,
    maxPerReader: 3,
    maxPerLink: 5,
    maxEntries: 10,
    ...options,
  });
}

const viewTimes = (limiter, linkId, reader, times, at = T0) =>
  Array.from({ length: times }, () => limiter.blockedFor(linkId, reader, at));

describe('createShareViewLimiter', () => {
  it('counts each reader of a link on its own', () => {
    const limiter = makeLimiter();
    expect(viewTimes(limiter, 'l1', 'a', 4)).toEqual([0, 0, 0, 60]);
    expect(limiter.blockedFor('l1', 'b', T0)).toBe(0);
  });

  it('caps a link across its readers, and frees it with the window', () => {
    const limiter = makeLimiter();
    ['a', 'b'].forEach((reader) => viewTimes(limiter, 'l1', reader, 2));
    expect(limiter.blockedFor('l1', 'c', T0)).toBe(0);
    expect(limiter.blockedFor('l1', 'd', T0 + 30 * 1000)).toBe(30);
    // Another link is not concerned.
    expect(limiter.blockedFor('l2', 'd', T0)).toBe(0);
    expect(limiter.blockedFor('l1', 'd', T0 + WINDOW_MS)).toBe(0);
  });

  it('does not count for the link the views of a blocked reader', () => {
    const limiter = makeLimiter({ maxPerReader: 2, maxPerLink: 3 });
    viewTimes(limiter, 'l1', 'a', 10);
    expect(limiter.blockedFor('l1', 'b', T0)).toBe(0);
  });

  it('keeps a blocked reader blocked however many new keys come in', () => {
    const limiter = makeLimiter({ maxPerLink: 1000 });
    viewTimes(limiter, 'l1', 'a', 4);
    for (let i = 0; i < 50; i += 1) {
      limiter.blockedFor('l1', `made-up-${i}`, T0);
    }
    expect(limiter.size().readers).toBeLessThanOrEqual(10);
    expect(limiter.blockedFor('l1', 'a', T0)).toBe(60);
  });

  it('drops the expired windows first once full', () => {
    const limiter = makeLimiter({ maxPerLink: 1000 });
    for (let i = 0; i < 10; i += 1) limiter.blockedFor('l1', `old-${i}`, T0);
    viewTimes(limiter, 'l1', 'a', 4, T0 + WINDOW_MS);
    limiter.blockedFor('l1', 'new', T0 + WINDOW_MS);
    expect(limiter.size().readers).toBe(2);
    expect(limiter.blockedFor('l1', 'a', T0 + WINDOW_MS)).toBe(60);
  });
});
