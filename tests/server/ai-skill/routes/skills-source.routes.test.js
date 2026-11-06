/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Production's side of a copy following it (ADR 0019, epic #1420): a super
// admin creates and revokes read tokens; a copy reads production's skills
// and expertises with one, on a route that takes the token only and answers
// nothing else. The rules of the follow itself are tested on the service
// (tests/server/ai-skill/skills-follow.service.test.js).

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
// The real rule: the platform capability.
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

const express = require('express');
const request = require('../../../helpers/local-request.js');
const f = require('../../../helpers/mcp-fixtures');

const SUPER_ADMIN = { id: f.ALICE, name: 'Alice', role: 'super_admin' };
const COMPANY_ADMIN = { id: f.ERIN, name: 'Erin', role: 'company_admin' };
const SUBJECT_LINES = 'redaction.subject-line';

// Turned on by #1424 (production's read tokens and read route)
describe.skip("production's read tokens and read route", () => {
  let skillsRouter;
  let skillsSourceRouter;

  beforeAll(() => {
    // Required here: the source router does not exist until #1424 ships it.
    ({
      skillsRouter,
      skillsSourceRouter,
    } = require('../../../../packages/server/ai-skill/ai-skill.routes'));
  });

  beforeEach(() => store.seed(f.SEED));

  // An app as index.js mounts it: the source route outside the session.
  function makeApp(user) {
    const app = express();
    app.use(express.json());
    app.use('/api/skills-source', skillsSourceRouter);
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

  const createToken = async (name = 'Staging') =>
    (
      await request(makeApp(SUPER_ADMIN))
        .post('/api/ai-skills/read-tokens')
        .send({ name })
    ).body;
  const readExport = (token) =>
    request(makeApp(null))
      .get('/api/skills-source/export')
      .set('Authorization', token ? `Bearer ${token}` : '');

  it('lets a super admin create a named token, shown once', async () => {
    const created = await createToken('Staging');

    expect(created).toMatchObject({
      name: 'Staging',
      token: expect.any(String),
    });
    expect(created.token.length).toBeGreaterThanOrEqual(32);
  });

  it('never stores nor lists the token itself', async () => {
    const { token } = await createToken();

    const listed = await request(makeApp(SUPER_ADMIN)).get(
      '/api/ai-skills/read-tokens'
    );

    expect(listed.body.items).toEqual([
      expect.objectContaining({ name: 'Staging', lastUsedAt: null }),
    ]);
    expect(JSON.stringify(listed.body)).not.toContain(token);
    expect(JSON.stringify(store.stored('readTokens'))).not.toContain(token);
  });

  it("answers production's export to a valid token, and records its use", async () => {
    const { token } = await createToken();

    const res = await readExport(token);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      format: 1,
      expertises: expect.arrayContaining([
        expect.objectContaining({
          expertiseId: SUBJECT_LINES,
          status: 'active',
        }),
      ]),
    });
    const listed = await request(makeApp(SUPER_ADMIN)).get(
      '/api/ai-skills/read-tokens'
    );
    expect(listed.body.items[0].lastUsedAt).not.toBeNull();
  });

  it('refuses a call without a token, or with an unknown one', async () => {
    expect((await readExport(null)).status).toBe(401);
    expect((await readExport('not-a-token')).status).toBe(401);
  });

  it('refuses a revoked token', async () => {
    const { id, token } = await createToken();

    const revoked = await request(makeApp(SUPER_ADMIN)).delete(
      `/api/ai-skills/read-tokens/${id}`
    );

    expect(revoked.status).toBe(204);
    expect((await readExport(token)).status).toBe(401);
  });

  it('reads nothing but the export with a token', async () => {
    const { token } = await createToken();

    const res = await request(makeApp(null))
      .get('/api/ai-skills')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it('lets no one else manage tokens', async () => {
    const app = makeApp(COMPANY_ADMIN);

    expect(
      (
        await request(app)
          .post('/api/ai-skills/read-tokens')
          .send({ name: 'x' })
      ).status
    ).toBe(401);
    expect((await request(app).get('/api/ai-skills/read-tokens')).status).toBe(
      401
    );
  });
});
