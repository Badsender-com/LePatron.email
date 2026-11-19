'use strict';

/**
 * Several drafts published at once, on the back office routes (ADR 0019,
 * #1431). The rules of the batch are tested on the service
 * (tests/server/ai-skill/skills-publication.service.test.js).
 */

jest.mock(
  '../../../../packages/server/ai-skill/services/publication-batch',
  () => ({
    draftsToPublish: jest.fn(),
    planMany: jest.fn(),
    guardMany: jest.fn(),
    publishMany: jest.fn(),
    cancelMany: jest.fn(),
  })
);
// The guard runs as a task of the server (guard-runs.js), tested on its own.
jest.mock('../../../../packages/server/ai-skill/services/guard-runs', () => ({
  startGuard: jest.fn(),
  readGuard: jest.fn(),
}));
// Whether this instance is a copy of production (ADR 0019).
const copy = { configured: true };
jest.mock(
  '../../../../packages/server/ai-skill/services/skills-source-client',
  () => ({ isConfigured: () => copy.configured })
);

const express = require('express');
const { ROLES } = require('../../../../packages/shared/access/roles.js');
const request = require('../../../helpers/local-request.js');
const publication = require('../../../../packages/server/ai-skill/services/publication-batch');
const guardRuns = require('../../../../packages/server/ai-skill/services/guard-runs');
const {
  skillsRouter,
} = require('../../../../packages/server/ai-skill/ai-skill.routes');

const ADMIN = { id: 'admin', role: 'super_admin' };
const ITEMS = [
  { kind: 'expertise', id: 'redaction.subject-line' },
  { kind: 'skill', id: 'redaction.subject-ideas' },
];
const TARGETS = [
  { ...ITEMS[0], version: { major: 2, minor: 2 } },
  { ...ITEMS[1], version: { major: 1, minor: 3 } },
];
const SKIPPED = [{ kind: 'skill', id: 'qc.other', reason: 'no_draft' }];
const GUARD = {
  usedBy: [],
  calls: 2,
  cases: [{ name: 'A sale' }],
  missing: [],
  key: 'the-key.signed',
};

function makeApp(user = ADMIN) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use('/api/ai-skills', skillsRouter);
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ ...err, message: err.message });
  });
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  publication.draftsToPublish.mockResolvedValue({
    targets: TARGETS,
    skipped: SKIPPED,
  });
});

describe('several drafts at once, on the back office', () => {
  it('says which drafts it would publish, which it leaves out, and what the guard would replay', async () => {
    publication.planMany.mockResolvedValue({
      usedBy: [],
      calls: 2,
      missing: [],
    });

    const res = await request(makeApp())
      .post('/api/ai-skills/publications/plan')
      .send({ items: ITEMS });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      targets: TARGETS,
      skipped: SKIPPED,
      usedBy: [],
      calls: 2,
      missing: [],
    });
    expect(publication.draftsToPublish).toHaveBeenCalledWith(ITEMS);
  });

  // No request waits for the AI (ADR 0019): the page reads the run again.
  it('starts one guard over the drafts on the server, and answers at once', async () => {
    const plan = { usedBy: [], calls: 2, missing: [] };
    const RUN = { id: 'run', status: 'running', ...plan };
    publication.draftsToPublish.mockResolvedValue({
      targets: TARGETS,
      skipped: [],
    });
    publication.planMany.mockResolvedValue(plan);
    guardRuns.startGuard.mockResolvedValue(RUN);

    const res = await request(makeApp())
      .post('/api/ai-skills/publications/guard')
      .send({ items: ITEMS });

    expect(res.body).toEqual(RUN);
    expect(guardRuns.startGuard).toHaveBeenCalledWith(
      { targets: TARGETS, plan, run: expect.any(Function) },
      ADMIN
    );
    expect(publication.guardMany).not.toHaveBeenCalled();
    publication.guardMany.mockResolvedValue(GUARD);
    await guardRuns.startGuard.mock.calls[0][0].run();
    expect(publication.guardMany).toHaveBeenCalledWith(TARGETS, ADMIN);
  });

  it('reads a run of the guard for the person who started it', async () => {
    const RUN = { id: 'run', status: 'done', ...GUARD };
    guardRuns.readGuard.mockResolvedValue(RUN);

    const res = await request(makeApp()).get(
      '/api/ai-skills/publications/guards/run'
    );

    expect(res.body).toEqual(RUN);
    expect(guardRuns.readGuard).toHaveBeenCalledWith('run', ADMIN);
  });

  // What the guard showed is the server's (ADR 0019): only its key goes.
  it('publishes with the key of the guard that ran, and reports each draft', async () => {
    publication.publishMany.mockResolvedValue({
      published: TARGETS,
      failed: [],
    });

    const res = await request(makeApp())
      .post('/api/ai-skills/publications')
      .send({ items: ITEMS, guard: GUARD, guardKey: GUARD.key });

    expect(res.body).toEqual({
      published: TARGETS,
      failed: [],
      skipped: SKIPPED,
    });
    expect(publication.publishMany).toHaveBeenCalledWith(
      TARGETS,
      { guardKey: GUARD.key, keepOnCopy: false },
      ADMIN
    );
  });

  it('records a cancellation only with the key of the guard that was cancelled', async () => {
    publication.cancelMany.mockResolvedValue({ cancelled: TARGETS });
    const app = makeApp();

    const refused = await request(app)
      .post('/api/ai-skills/publications/cancel')
      .send({ items: ITEMS, guard: GUARD });
    const cancelled = await request(app)
      .post('/api/ai-skills/publications/cancel')
      .send({ items: ITEMS, guardKey: GUARD.key });

    expect(refused.status).toBe(400);
    expect(refused.body.message).toBe('SKILL_PUBLICATION_GUARD_INVALID');
    expect(cancelled.status).toBe(200);
    expect(publication.cancelMany).toHaveBeenCalledTimes(1);
  });

  // On a copy, the whole batch is kept on it, or follows production.
  it('keeps the batch on the copy when asked, and only on a copy', async () => {
    publication.publishMany.mockResolvedValue({ published: [], failed: [] });
    const publish = (body) =>
      request(makeApp())
        .post('/api/ai-skills/publications')
        .send({ items: ITEMS, guardKey: GUARD.key, ...body });

    await publish({ keepOnCopy: true });
    await publish({ keepOnCopy: false });
    copy.configured = false;
    const refused = await publish({ keepOnCopy: true });
    copy.configured = true;

    expect(publication.publishMany.mock.calls.map((c) => c[1])).toEqual([
      { guardKey: GUARD.key, keepOnCopy: true },
      { guardKey: GUARD.key, keepOnCopy: false },
    ]);
    expect(refused.body.message).toBe('SKILLS_NOT_A_COPY');
  });

  // When the page read each draft goes with it (ADR 0014), and nothing else.
  it('reads when the page read each draft, as a string only', async () => {
    const readAt = '2026-11-04T10:00:00.000Z';

    await request(makeApp())
      .post('/api/ai-skills/publications')
      .send({
        items: [
          { ...ITEMS[0], updatedAt: readAt },
          { ...ITEMS[1], updatedAt: { $gt: '' } },
        ],
      });

    expect(publication.draftsToPublish).toHaveBeenCalledWith([
      { ...ITEMS[0], updatedAt: readAt },
      ITEMS[1],
    ]);
  });

  it('refuses a selection that names no item, too many, or an unknown kind, with its code', async () => {
    const app = makeApp();
    const plan = (items) =>
      request(app).post('/api/ai-skills/publications/plan').send({ items });

    const empty = await plan([]);
    const tooMany = await plan(
      Array.from({ length: 201 }, (_, i) => ({ kind: 'skill', id: `s.${i}` }))
    );
    const unknown = await plan([{ kind: 'template', id: 'x' }]);

    expect([empty.status, empty.body.message]).toEqual([
      400,
      'SKILLS_PUBLICATION_SELECTION_EMPTY',
    ]);
    expect(tooMany.body).toMatchObject({
      message: 'SKILLS_PUBLICATION_SELECTION_TOO_BIG',
      max: 200,
    });
    expect([unknown.status, unknown.body.message]).toEqual([
      400,
      'SKILLS_PUBLICATION_SELECTION_INVALID',
    ]);
    expect(publication.draftsToPublish).not.toHaveBeenCalled();
  });

  // The routes' own guard, as each role meets it (AGENTS.md, Rights).
  describe.each(Object.values(ROLES))('for a %s', (role) => {
    const allowed = role === ROLES.SUPER_ADMIN;

    it.each([
      ['plan', 'planMany'],
      ['guard', 'planMany'],
      ['cancel', 'cancelMany'],
      ['', 'publishMany'],
    ])(
      `${allowed ? 'reaches' : 'is refused'} the batch's %s route`,
      async (action, call) => {
        publication[call].mockResolvedValue({ published: [], failed: [] });

        const res = await request(makeApp({ id: 'someone', role }))
          .post(`/api/ai-skills/publications${action && `/${action}`}`)
          .send({ items: ITEMS, guardKey: GUARD.key });

        if (allowed) {
          expect(res.status).toBe(200);
          expect(publication[call]).toHaveBeenCalled();
        } else {
          expect(res.status).toBe(401);
          expect(publication[call]).not.toHaveBeenCalled();
        }
      }
    );

    it(`${
      allowed ? 'reaches' : 'is refused'
    } the read of a run of the guard`, async () => {
      guardRuns.readGuard.mockResolvedValue({ id: 'run', status: 'running' });

      const res = await request(makeApp({ id: 'someone', role })).get(
        '/api/ai-skills/publications/guards/run'
      );

      expect(res.status).toBe(allowed ? 200 : 401);
      expect(guardRuns.readGuard).toHaveBeenCalledTimes(allowed ? 1 : 0);
    });
  });
});
