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
  nightly: false,
  answer: null,
};
jest.doMock(
  '../../../../packages/server/ai-skill/services/skills-source-client.js',
  () => ({
    isConfigured: () => source.configured,
    isNightly: () => source.configured && source.nightly,
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

const { ROLES } = require('../../../../packages/shared/access/roles.js');

const SUPER_ADMIN = { id: f.ALICE, name: 'Alice', role: 'super_admin' };
const EMPTY_COPY = { ...f.SEED, expertises: [], skills: [] };
const SUBJECT_LINES = 'redaction.subject-line';
const SUBJECT_IDEAS = 'redaction.subject-ideas';

// Every route of a copy (ADR 0019), as each role calls it.
const COPY_ROUTES = [
  ['get', '/api/ai-skills/follow'],
  ['post', '/api/ai-skills/follow'],
  ['post', `/api/ai-skills/${SUBJECT_IDEAS}/keep-on-copy`],
  ['delete', `/api/ai-skills/${SUBJECT_IDEAS}/keep-on-copy`],
  ['post', `/api/ai-skills/${SUBJECT_IDEAS}/duplicate-on-copy`],
  ['post', `/api/ai-expertise/${SUBJECT_LINES}/keep-on-copy`],
  ['delete', `/api/ai-expertise/${SUBJECT_LINES}/keep-on-copy`],
  ['post', `/api/ai-expertise/${SUBJECT_LINES}/duplicate-on-copy`],
];
const OTHER_ROLES = Object.values(ROLES).filter(
  (role) => role !== ROLES.SUPER_ADMIN
);

describe("a copy's follow of production", () => {
  let skillsRouter;
  let expertiseRouter;
  let exportForCopies;

  beforeAll(() => {
    ({
      skillsRouter,
      expertiseRouter,
    } = require('../../../../packages/server/ai-skill/ai-skill.routes'));
    ({
      exportForCopies,
    } = require('../../../../packages/server/ai-skill/services/skills-follow.format'));
  });

  beforeEach(async () => {
    store.seed(f.SEED);
    source.configured = true;
    source.nightly = false;
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
    app.use('/api/ai-expertise', expertiseRouter);
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
      isCopy: false,
      configured: false,
      production: null,
      nightly: { enabled: false },
      lock: null,
      last: null,
    });
    const followed = await request(app).post('/api/ai-skills/follow');
    expect(followed.status).toBe(409);
    expect(followed.body.message).toBe('SKILLS_NOT_A_COPY');
    expect(store.stored('expertises')).toEqual([]);
  });

  it('says whether the copy follows production every night', async () => {
    source.nightly = true;

    const shown = await request(makeApp(SUPER_ADMIN)).get(
      '/api/ai-skills/follow'
    );

    expect(shown.body).toMatchObject({
      isCopy: true,
      nightly: { enabled: true },
    });
  });

  it('says a follow is running, and refuses a second one', async () => {
    const startedAt = new Date();
    store.seed({
      ...EMPTY_COPY,
      follows: [
        {
          status: 'running',
          trigger: 'night',
          by: '',
          startedAt,
          expiresAt: new Date(Date.now() + 60 * 1000),
        },
      ],
    });
    const app = makeApp(SUPER_ADMIN);

    const shown = await request(app).get('/api/ai-skills/follow');
    const followed = await request(app).post('/api/ai-skills/follow');

    expect(shown.body.lock).toMatchObject({
      trigger: 'night',
      startedAt: startedAt.toISOString(),
    });
    expect(followed.status).toBe(409);
    expect(followed.body.message).toBe('SKILLS_FOLLOW_RUNNING');
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

  describe('an item of the copy', () => {
    const followed = async () => {
      await request(makeApp(SUPER_ADMIN)).post('/api/ai-skills/follow');
      return makeApp(SUPER_ADMIN);
    };
    const expertiseOf = (id) =>
      store.stored('expertises').find((e) => e.expertiseId === id);

    it('is kept on the copy, then follows production again', async () => {
      const app = await followed();

      const kept = await request(app).post(
        `/api/ai-expertise/${SUBJECT_LINES}/keep-on-copy`
      );
      expect(kept.status).toBe(200);
      expect(kept.body).toMatchObject({
        keptOnCopy: true,
        _keptOnCopyBy: f.ALICE,
      });
      expect(expertiseOf(SUBJECT_LINES).keptOnCopyAt).toBeTruthy();

      const attached = await request(app).delete(
        `/api/ai-expertise/${SUBJECT_LINES}/keep-on-copy`
      );
      expect(attached.status).toBe(200);
      expect(expertiseOf(SUBJECT_LINES)).toMatchObject({
        keptOnCopy: false,
        keptOnCopyAt: null,
      });
    });

    // An item imported before the copy followed production is taken over
    // by the first follow: it may be kept before, and followed again.
    it('is kept on the copy and followed again before any follow', async () => {
      store.seed({ ...f.SEED });
      const app = makeApp(SUPER_ADMIN);

      const kept = await request(app).post(
        `/api/ai-expertise/${SUBJECT_LINES}/keep-on-copy`
      );
      expect(kept.status).toBe(200);
      expect(expertiseOf(SUBJECT_LINES).keptOnCopy).toBe(true);

      const attached = await request(app).delete(
        `/api/ai-expertise/${SUBJECT_LINES}/keep-on-copy`
      );
      expect(attached.status).toBe(200);
      expect(expertiseOf(SUBJECT_LINES).keptOnCopy).toBe(false);
    });

    it('is kept on the copy by its publication before any follow', async () => {
      store.seed({ ...f.SEED });

      const res = await request(makeApp(SUPER_ADMIN))
        .post(`/api/ai-expertise/${SUBJECT_LINES}/versions/3.0/activate`)
        .send({ changelog: 'c', releaseNotes: 'r', keepOnCopy: true });

      expect(res.status).toBe(200);
      expect(expertiseOf(SUBJECT_LINES)).toMatchObject({
        keptOnCopy: true,
        activeVersion: { major: 3, minor: 0 },
      });
    });

    it('has a version duplicated into a new item of the copy', async () => {
      const app = await followed();

      const res = await request(app)
        .post(`/api/ai-expertise/${SUBJECT_LINES}/duplicate-on-copy`)
        .send({ version: '2.1' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        expertiseId: `${SUBJECT_LINES}.copie`,
        title: 'Subject lines (travail de la copie)',
        copiedFrom: SUBJECT_LINES,
        audience: 'platform',
        activeVersion: { major: null, minor: 0 },
        versions: [
          expect.objectContaining({
            versionMajor: 2,
            versionMinor: 1,
            status: 'DRAFT',
          }),
        ],
      });
      expect(res.body.versions[0]).not.toHaveProperty('followedAt');
      expect(expertiseOf(SUBJECT_LINES).versions).toHaveLength(2);
    });

    it('duplicates a skill into one served to no assistant', async () => {
      const app = await followed();

      const res = await request(app)
        .post(`/api/ai-skills/${SUBJECT_IDEAS}/duplicate-on-copy`)
        .send({ version: '1.2' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        skillId: `${SUBJECT_IDEAS}.copie`,
        servedToAssistants: false,
      });
    });

    it.each([['9.9'], ['not a version'], [undefined]])(
      'refuses to duplicate a version it does not hold (%s)',
      async (version) => {
        const app = await followed();

        const res = await request(app)
          .post(`/api/ai-expertise/${SUBJECT_LINES}/duplicate-on-copy`)
          .send({ version });

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('SKILLS_COPY_VERSION_NOT_FOUND');
      }
    );

    it.each(COPY_ROUTES.slice(2))(
      'is refused on an instance that is not a copy: %s %s',
      async (method, url) => {
        store.seed({ ...f.SEED });
        source.configured = false;

        const res = await request(makeApp(SUPER_ADMIN))
          [method](url)
          .send({ version: '1.0' });

        expect(res.status).toBe(409);
        expect(res.body.message).toBe('SKILLS_NOT_A_COPY');
      }
    );

    it('is kept on the copy by its publication, when asked', async () => {
      const app = await followed();

      const res = await request(app)
        .post(`/api/ai-expertise/${SUBJECT_LINES}/versions/3.0/activate`)
        .send({ changelog: 'c', releaseNotes: 'r', keepOnCopy: true });

      expect(res.status).toBe(200);
      expect(expertiseOf(SUBJECT_LINES)).toMatchObject({
        keptOnCopy: true,
        activeVersion: { major: 3, minor: 0 },
      });
    });

    it('refuses keepOnCopy at a publication on an instance that is not a copy', async () => {
      store.seed({ ...f.SEED });
      source.configured = false;

      const res = await request(makeApp(SUPER_ADMIN))
        .post(`/api/ai-expertise/${SUBJECT_LINES}/versions/3.0/activate`)
        .send({ changelog: 'c', releaseNotes: 'r', keepOnCopy: true });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('SKILLS_NOT_A_COPY');
    });
  });

  // Every role but the super admin's is refused, on every route of a copy.
  describe.each(OTHER_ROLES)('a %s', (role) => {
    it.each(COPY_ROUTES)('is refused %s %s', async (method, url) => {
      const app = makeApp({ id: f.ERIN, name: 'Someone', role });

      const res = await request(app)[method](url).send({ version: '1.0' });

      expect(res.status).toBe(401);
    });
  });

  it.each(COPY_ROUTES)('lets a super admin %s %s', async (method, url) => {
    const app = await (async () => {
      await request(makeApp(SUPER_ADMIN)).post('/api/ai-skills/follow');
      return makeApp(SUPER_ADMIN);
    })();

    const res = await request(app)[method](url).send({ version: '1.0' });

    expect(res.status).not.toBe(401);
  });
});
