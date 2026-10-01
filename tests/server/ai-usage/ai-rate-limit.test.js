'use strict';

jest.mock('../../../packages/server/common/models.common', () => ({
  AIUsageCounters: { findOneAndUpdate: jest.fn() },
}));
jest.mock('../../../packages/server/node.config.js', () => ({
  aiRateLimits: { perUserPerMinute: 2, perUserPerDay: 5, perGroupPerDay: 10 },
}));

const {
  AIUsageCounters,
} = require('../../../packages/server/common/models.common');
const {
  aiRateLimit,
  consume,
} = require('../../../packages/server/ai-usage/ai-rate-limit.js');

const LIMITS = { perUserPerMinute: 2, perUserPerDay: 5, perGroupPerDay: 10 };
const NOW = new Date('2026-10-01T09:41:30.000Z');

// A fake store: one count per key, as the upserted counters would hold.
let store;
beforeEach(() => {
  store = new Map();
  AIUsageCounters.findOneAndUpdate.mockReset();
  AIUsageCounters.findOneAndUpdate.mockImplementation(({ key }) => ({
    lean: () => {
      store.set(key, (store.get(key) || 0) + 1);
      return Promise.resolve({ count: store.get(key) });
    },
  }));
});

describe('consume', () => {
  it('counts the request in the user minute, user day and group day windows', async () => {
    await consume({ userId: 'u1', groupId: 'g1', now: NOW, limits: LIMITS });
    expect([...store.keys()]).toEqual([
      'user:u1:minute:2026-10-01T09:41',
      'user:u1:day:2026-10-01',
      'group:g1:day:2026-10-01',
    ]);
  });

  it('refuses the request past a limit, with the wait until that window ends', async () => {
    await consume({ userId: 'u1', groupId: 'g1', now: NOW, limits: LIMITS });
    await consume({ userId: 'u1', groupId: 'g1', now: NOW, limits: LIMITS });
    const err = await consume({
      userId: 'u1',
      groupId: 'g1',
      now: NOW,
      limits: LIMITS,
    }).catch((e) => e);
    expect(err.status).toBe(429);
    expect(err.message).toBe('AI_RATE_LIMITED');
    expect(err.retryAfterSeconds).toBe(30);
  });

  it('starts a new minute window', async () => {
    await consume({ userId: 'u1', groupId: 'g1', now: NOW, limits: LIMITS });
    await consume({ userId: 'u1', groupId: 'g1', now: NOW, limits: LIMITS });
    const nextMinute = new Date('2026-10-01T09:42:00.000Z');
    await expect(
      consume({ userId: 'u1', groupId: 'g1', now: nextMinute, limits: LIMITS })
    ).resolves.toBeUndefined();
  });

  it('shares the group window between its users', async () => {
    const err = await (async () => {
      for (let i = 0; i < 11; i += 1) {
        // A new user each time: only the group window can refuse.
        await consume({
          userId: `u${i}`,
          groupId: 'g1',
          now: NOW,
          limits: LIMITS,
        });
      }
    })().catch((e) => e);
    expect(err.status).toBe(429);
    expect(store.get('group:g1:day:2026-10-01')).toBe(11);
  });

  it('counts only the user windows when there is no group (super-admin)', async () => {
    await consume({ userId: 'admin', now: NOW, limits: LIMITS });
    expect([...store.keys()].some((k) => k.startsWith('group:'))).toBe(false);
  });

  it('ignores a window whose limit is not set', async () => {
    await consume({
      userId: 'u1',
      groupId: 'g1',
      now: NOW,
      limits: { perUserPerMinute: 2 },
    });
    expect([...store.keys()]).toEqual(['user:u1:minute:2026-10-01T09:41']);
  });
});

describe('aiRateLimit middleware', () => {
  function run(middleware, req) {
    const res = { set: jest.fn() };
    return new Promise((resolve) => {
      middleware(req, res, (err) => resolve({ err, res }));
    });
  }
  const user = { id: 'u1', group: { id: 'g1' } };

  it('lets a normal request through', async () => {
    const { err } = await run(aiRateLimit(), {
      user,
      body: { text: 'Bonjour' },
    });
    expect(err).toBeUndefined();
  });

  it('refuses an oversized payload without counting it', async () => {
    const { err } = await run(aiRateLimit({ maxBodyBytes: 10 }), {
      user,
      body: { text: 'far more than ten bytes' },
    });
    expect(err.status).toBe(413);
    expect(err.message).toBe('AI_PAYLOAD_TOO_LARGE');
    expect(AIUsageCounters.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('sets Retry-After when it refuses', async () => {
    const middleware = aiRateLimit();
    await run(middleware, { user, body: {} });
    await run(middleware, { user, body: {} });
    const { err, res } = await run(middleware, { user, body: {} });
    expect(err.status).toBe(429);
    expect(res.set).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });
});
