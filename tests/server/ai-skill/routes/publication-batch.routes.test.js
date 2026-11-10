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
// Stub the auth guard, on the real rule, so the test picks the user.
jest.mock('../../../../packages/server/account/auth.guard', () => ({
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
const publication = require('../../../../packages/server/ai-skill/services/publication-batch');
const {
  skillsRouter,
} = require('../../../../packages/server/ai-skill/ai-skill.routes');

const ADMIN = { id: 'admin', role: 'super_admin' };
const COMPANY_ADMIN = { id: 'erin', role: 'company_admin' };
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

  it('runs one guard over the drafts', async () => {
    publication.guardMany.mockResolvedValue(GUARD);

    const res = await request(makeApp())
      .post('/api/ai-skills/publications/guard')
      .send({ items: ITEMS });

    expect(res.body).toEqual(GUARD);
    expect(publication.guardMany).toHaveBeenCalledWith(TARGETS, ADMIN);
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
      { guardKey: GUARD.key },
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

  it('lets no one else publish', async () => {
    const res = await request(makeApp(COMPANY_ADMIN))
      .post('/api/ai-skills/publications')
      .send({ items: ITEMS });

    expect(res.status).toBe(401);
    expect(publication.publishMany).not.toHaveBeenCalled();
  });
});
