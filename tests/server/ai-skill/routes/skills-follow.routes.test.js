/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// A copy's side of following production (ADR 0019, #1425): a super admin
// sees whether the copy follows a production and how the last follow went,
// and follows it now. The rules of the follow itself are tested on the
// service (tests/server/ai-skill/skills-follow.service.test.js).

const { createMcpStore } = require('../../../helpers/mcp-fake-models');

const store = createMcpStore();
jest.doMock(
  '../../../../packages/server/common/models.common.js',
  () => store.models
);
jest.doMock('../../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.doMock('../../../../packages/server/account/auth.guard', () => ({
  GUARD_ADMIN: (req, res, next) => {
    const permissions = require('../../../../packages/server/account/permissions.js');
    const {
      CAPABILITIES,
    } = require('../../../../packages/shared/access/roles.js');
    if (permissions.can(req.user, CAPABILITIES.PLATFORM_MANAGE)) return next();
    return res.status(401).json({ message: 'Unauthorized' });
  },
}));
// Production, as the copy's configuration reaches it.
const source = {
  configured: true,
  answer: null,
};
jest.doMock(
  '../../../../packages/server/ai-skill/services/skills-source-client.js',
  () => ({
    isConfigured: () => source.configured,
    productionOrigin: () =>
      source.configured ? 'https://production.example' : null,
    fetchProductionExport: async () => {
      if (!source.answer) throw new Error('Production: unreachable');
      return JSON.parse(JSON.stringify(source.answer));
    },
  })
);

const express = require('express');
const request = require('../../../helpers/local-request.js');
const f = require('../../../helpers/mcp-fixtures');

const SUPER_ADMIN = { id: f.ALICE, name: 'Alice', role: 'super_admin' };
const COMPANY_ADMIN = { id: f.ERIN, name: 'Erin', role: 'company_admin' };
const EMPTY_COPY = { ...f.SEED, expertises: [], skills: [] };

describe("a copy's follow of production", () => {
  let skillsRouter;
  let exportForCopies;

  beforeAll(() => {
    ({
      skillsRouter,
    } = require('../../../../packages/server/ai-skill/ai-skill.routes'));
    ({
      exportForCopies,
    } = require('../../../../packages/server/ai-skill/services/skills-follow.service'));
  });

  beforeEach(async () => {
    store.seed(f.SEED);
    source.configured = true;
    source.answer = await exportForCopies();
    store.seed(EMPTY_COPY);
  });

  function makeApp(user) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = user;
      next();
    });
    app.use('/api/ai-skills', skillsRouter);
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ message: err.message });
    });
    return app;
  }

  it('says a copy without a production follows nothing, and follows nothing', async () => {
    source.configured = false;
    const app = makeApp(SUPER_ADMIN);

    const shown = await request(app).get('/api/ai-skills/follow');
    expect(shown.body).toEqual({
      configured: false,
      production: null,
      last: null,
    });
    expect((await request(app).post('/api/ai-skills/follow')).status).toBe(409);
    expect(store.stored('expertises')).toEqual([]);
  });

  it('follows production now, and answers the report and the last follow', async () => {
    const app = makeApp(SUPER_ADMIN);

    const res = await request(app).post('/api/ai-skills/follow');

    expect(res.status).toBe(200);
    expect(res.body.report).toMatchObject({ status: 'succeeded', failed: [] });
    expect(res.body.report.created.length).toBeGreaterThan(0);
    expect(res.body.last).toMatchObject({ status: 'succeeded', by: 'Alice' });

    const shown = await request(app).get('/api/ai-skills/follow');
    expect(shown.body).toMatchObject({
      configured: true,
      production: 'https://production.example',
      last: { status: 'succeeded' },
    });
  });

  it('answers a follow that could not reach production, having written nothing', async () => {
    source.answer = null;

    const res = await request(makeApp(SUPER_ADMIN)).post(
      '/api/ai-skills/follow'
    );

    expect(res.status).toBe(200);
    expect(res.body.report).toMatchObject({ status: 'failed' });
    expect(store.stored('expertises')).toEqual([]);
  });

  it('lets no one else see or follow', async () => {
    const app = makeApp(COMPANY_ADMIN);

    expect((await request(app).get('/api/ai-skills/follow')).status).toBe(401);
    expect((await request(app).post('/api/ai-skills/follow')).status).toBe(401);
  });
});
