'use strict';

jest.mock('../../../packages/server/common/models.common', () => ({
  AIUsageCounters: { findOneAndUpdate: jest.fn() },
}));
jest.mock('../../../packages/server/node.config.js', () => ({
  aiRateLimits: { perUserPerMinute: 2, perUserPerDay: 5, perGroupPerDay: 10 },
  admin: { id: 'bootstrap-admin' },
}));

const express = require('express');
const bodyParser = require('body-parser');
const request = require('supertest');

const {
  AIUsageCounters,
} = require('../../../packages/server/common/models.common');
const {
  aiRateLimit,
  aiBodyParser,
  consume,
} = require('../../../packages/server/ai-usage/ai-rate-limit.js');
const { ROLES } = require('../../../packages/shared/access/roles.js');

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

  it('counts only the user windows when there is no group', async () => {
    await consume({ userId: 'admin', now: NOW, limits: LIMITS });
    expect([...store.keys()].some((k) => k.startsWith('group:'))).toBe(false);
  });

  it('reads limits given as strings, as an environment variable sets them', async () => {
    const limits = {
      perUserPerMinute: '2',
      perUserPerDay: '5',
      perGroupPerDay: '10',
    };
    await consume({ userId: 'u1', groupId: 'g1', now: NOW, limits });
    await consume({ userId: 'u1', groupId: 'g1', now: NOW, limits });
    const err = await consume({
      userId: 'u1',
      groupId: 'g1',
      now: NOW,
      limits,
    }).catch((e) => e);
    expect(err.status).toBe(429);
  });

  it('does not count in the group window a request the user window refuses', async () => {
    const refusals = [];
    for (let i = 0; i < 6; i += 1) {
      await consume({
        userId: 'u1',
        groupId: 'g1',
        now: NOW,
        limits: LIMITS,
      }).catch((e) => refusals.push(e));
    }
    expect(refusals).toHaveLength(4);
    // The user's own windows still count the refused requests.
    expect(store.get('user:u1:minute:2026-10-01T09:41')).toBe(6);
    expect(store.get('group:g1:day:2026-10-01')).toBe(2);
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

  const today = () => new Date().toISOString().slice(0, 10);
  const groupKeys = () =>
    [...store.keys()].filter((key) => key.startsWith('group:'));

  it("counts a user's request against the user's own company", async () => {
    await run(aiRateLimit(), { user, body: {} });
    expect(groupKeys()).toEqual([`group:g1:day:${today()}`]);
  });

  it("counts a super admin's request against the company it has selected", async () => {
    const superAdmin = {
      id: 'sa',
      role: ROLES.SUPER_ADMIN,
      // A persisted super admin belongs to the platform group (ADR 0002).
      group: { id: 'platform' },
      selectedGroup: { id: 'client' },
    };
    await run(aiRateLimit(), { user: superAdmin, body: {} });
    expect(groupKeys()).toEqual([`group:client:day:${today()}`]);
  });

  it('counts only its own windows for a super admin with no company selected', async () => {
    const superAdmin = {
      id: 'sa',
      role: ROLES.SUPER_ADMIN,
      group: { id: 'platform' },
    };
    const { err } = await run(aiRateLimit(), { user: superAdmin, body: {} });
    expect(err).toBeUndefined();
    expect(groupKeys()).toEqual([]);
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

describe('aiBodyParser', () => {
  // As index.js mounts it: before the app's own 50 MB parser.
  const app = express();
  app.use('/ai', aiBodyParser);
  app.use(bodyParser.json({ limit: '50mb' }));
  app.post('*', (req, res) => res.json({ received: req.body }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(err.status).json({ status: err.status, message: err.message });
  });

  it('reads a body under 256 KB', async () => {
    const res = await request(app).post('/ai').send({ text: 'Bonjour' });
    expect(res.status).toBe(200);
    expect(res.body.received).toEqual({ text: 'Bonjour' });
  });

  it('refuses a larger body with AI_PAYLOAD_TOO_LARGE', async () => {
    const res = await request(app)
      .post('/ai')
      .send({ text: 'x'.repeat(300 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ status: 413, message: 'AI_PAYLOAD_TOO_LARGE' });
  });

  it('caps a form-encoded body too', async () => {
    const res = await request(app)
      .post('/ai')
      .type('form')
      .send(`text=${'x'.repeat(300 * 1024)}`);
    expect(res.status).toBe(413);
  });

  it('leaves the other routes to the app parser', async () => {
    const res = await request(app)
      .post('/other')
      .send({ text: 'x'.repeat(300 * 1024) });
    expect(res.status).toBe(200);
  });
});
