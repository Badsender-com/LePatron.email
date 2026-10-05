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

  it('skips a request without a key', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await run(limiter, { key: null })).err).toBeUndefined();
    }
  });
});

describe('clientIp', () => {
  it('reads the first forwarded address behind the proxy', () => {
    expect(
      clientIp({ headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } })
    ).toBe('203.0.113.7');
  });

  it('falls back to the connection address', () => {
    expect(clientIp({ headers: {}, ip: '198.51.100.2' })).toBe('198.51.100.2');
  });
});
