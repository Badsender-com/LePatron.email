'use strict';

const {
  createRateLimiter,
  clientIp,
} = require('../../../packages/server/utils/rate-limit.js');

function run(limiter, req) {
  return new Promise((resolve) => {
    const res = { set: jest.fn() };
    limiter(req, res, (err) => resolve({ err, res }));
  });
}

describe('createRateLimiter', () => {
  let clock;
  let limiter;

  beforeEach(() => {
    clock = 1_000_000;
    limiter = createRateLimiter({
      windowMs: 60_000,
      max: 2,
      keyOf: (req) => req.key,
      now: () => clock,
    });
  });

  it('lets the allowed calls through, then answers 429 with a Retry-After', async () => {
    expect((await run(limiter, { key: 'a' })).err).toBeUndefined();
    expect((await run(limiter, { key: 'a' })).err).toBeUndefined();

    const { err, res } = await run(limiter, { key: 'a' });

    expect(err.status).toBe(429);
    expect(res.set).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('counts each key on its own', async () => {
    await run(limiter, { key: 'a' });
    await run(limiter, { key: 'a' });

    expect((await run(limiter, { key: 'b' })).err).toBeUndefined();
  });

  it('opens a new window once the previous one is over', async () => {
    await run(limiter, { key: 'a' });
    await run(limiter, { key: 'a' });
    clock += 60_000;

    expect((await run(limiter, { key: 'a' })).err).toBeUndefined();
  });

  it('keeps the store bounded by dropping the oldest windows', async () => {
    const small = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      keyOf: (req) => req.key,
      now: () => clock,
      maxEntries: 3,
    });
    for (const key of ['a', 'b', 'c', 'd']) await run(small, { key });

    // 'a' was evicted, so its window starts afresh.
    expect((await run(small, { key: 'a' })).err).toBeUndefined();
    expect((await run(small, { key: 'd' })).err.status).toBe(429);
  });

  it('keeps a window that reached its limit when new keys fill the store', async () => {
    const small = createRateLimiter({
      windowMs: 60_000,
      max: 2,
      keyOf: (req) => req.key,
      now: () => clock,
      maxEntries: 3,
    });
    await run(small, { key: 'victim' });
    await run(small, { key: 'victim' });
    for (const key of ['b', 'c', 'd', 'e']) await run(small, { key });

    expect((await run(small, { key: 'victim' })).err.status).toBe(429);
  });

  it('skips a request without a key', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await run(limiter, { key: null })).err).toBeUndefined();
    }
  });
});

describe('createRateLimiter counting the failed calls only', () => {
  const EventEmitter = require('events');

  function call(limiter, statusCode) {
    return new Promise((resolve) => {
      const res = Object.assign(new EventEmitter(), { set: jest.fn() });
      limiter({ key: 'a' }, res, (err) => {
        if (!err) {
          res.statusCode = statusCode;
          res.emit('finish');
        }
        resolve(err);
      });
    });
  }

  let limiter;
  beforeEach(() => {
    limiter = createRateLimiter({
      windowMs: 60_000,
      max: 2,
      keyOf: (req) => req.key,
      refundSuccess: true,
      now: () => 1_000_000,
    });
  });

  it('gives a successful call back', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect(await call(limiter, 200)).toBeUndefined();
    }
  });

  it('answers 429 once the failed calls reach the limit', async () => {
    await call(limiter, 400);
    await call(limiter, 400);

    expect((await call(limiter, 200)).status).toBe(429);
  });

  it('counts a call while it runs, so parallel attempts do not overtake the limit', async () => {
    const pending = () =>
      new Promise((resolve) => {
        const res = Object.assign(new EventEmitter(), { set: jest.fn() });
        limiter({ key: 'a' }, res, resolve);
      });
    await pending();
    await pending();

    expect((await pending()).status).toBe(429);
  });
});

describe('clientIp', () => {
  it('reads the address the proxy appended, not one the client sent', () => {
    expect(
      clientIp({
        headers: { 'x-forwarded-for': '198.51.100.9, 203.0.113.7' },
      })
    ).toBe('203.0.113.7');
  });

  it('skips the internal hops appended after the client', () => {
    expect(
      clientIp({
        headers: {
          'x-forwarded-for':
            '198.51.100.9, 203.0.113.7, 10.2.0.4, ::ffff:172.17.0.2',
        },
      })
    ).toBe('203.0.113.7');
  });

  it('keeps the last entry of a chain made of internal hops only', () => {
    expect(
      clientIp({ headers: { 'x-forwarded-for': '10.0.0.1, 192.168.1.2' } })
    ).toBe('192.168.1.2');
  });

  it('ignores an empty forwarded chain', () => {
    expect(
      clientIp({ headers: { 'x-forwarded-for': ' , ' }, ip: '198.51.100.2' })
    ).toBe('198.51.100.2');
  });

  it('falls back to the connection address', () => {
    expect(clientIp({ headers: {}, ip: '198.51.100.2' })).toBe('198.51.100.2');
  });
});
