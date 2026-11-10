'use strict';

/**
 * The publication guard on the back office routes (ADR 0019, #1430): what
 * the guard would replay, the replay, a cancellation, and a publication that
 * carries the guard. The guard's rules are tested on the service
 * (tests/server/ai-skill/skills-publication.service.test.js).
 */

jest.mock(
  '../../../../packages/server/ai-skill/services/skills-publication.service',
  () => ({
    ...jest.requireActual(
      '../../../../packages/server/ai-skill/services/skills-publication.service'
    ),
    planPublication: jest.fn(),
    guardPublication: jest.fn(),
    cancelPublication: jest.fn(),
    publishVersion: jest.fn(),
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

const createError = require('http-errors');
const express = require('express');
const request = require('../../../helpers/local-request.js');
const publication = require('../../../../packages/server/ai-skill/services/skills-publication.service');
const {
  skillsRouter,
  expertiseRouter,
} = require('../../../../packages/server/ai-skill/ai-skill.routes');

const ADMIN = { id: 'admin', role: 'super_admin' };
const SUBJECT_LINES = 'redaction.subject-line';
const VERSION = { major: 2, minor: 2 };
const GUARD = {
  usedBy: [{ featureType: 'subject_generation', description: 'Subjects' }],
  calls: 2,
  cases: [{ skillId: 'redaction.subject-ideas', name: 'A sale' }],
  missing: [],
};

function makeApp(user = ADMIN) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use('/api/ai-skills', skillsRouter);
  app.use('/api/ai-expertise', expertiseRouter);
  // As the app's own handler: the error's fields reach the body.
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ ...err, message: err.message });
  });
  return app;
}

const versionRoute = (path) =>
  `/api/ai-expertise/${SUBJECT_LINES}/versions/2.2/${path}`;

beforeEach(() => jest.clearAllMocks());

describe('the publication guard on the back office', () => {
  it('says what the guard would replay, before it runs', async () => {
    publication.planPublication.mockResolvedValue({
      usedBy: GUARD.usedBy,
      calls: 2,
      missing: [],
    });

    const res = await request(makeApp()).get(versionRoute('publication'));

    expect(res.status).toBe(200);
    expect(res.body.calls).toBe(2);
    expect(publication.planPublication).toHaveBeenCalledWith({
      kind: 'expertise',
      id: SUBJECT_LINES,
      version: VERSION,
    });
  });

  it('refuses a version not written as major.minor, with its code', async () => {
    const res = await request(makeApp()).get(
      `/api/ai-expertise/${SUBJECT_LINES}/versions/latest/publication`
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('SKILL_PUBLICATION_VERSION_INVALID');
    expect(publication.planPublication).not.toHaveBeenCalled();
  });

  it('runs the guard on a version', async () => {
    publication.guardPublication.mockResolvedValue(GUARD);

    const res = await request(makeApp()).post(
      '/api/ai-skills/redaction.subject-ideas/versions/1.3/guard'
    );

    expect(res.body).toEqual(GUARD);
    expect(publication.guardPublication).toHaveBeenCalledWith({
      kind: 'skill',
      id: 'redaction.subject-ideas',
      version: { major: 1, minor: 3 },
    });
  });

  it('publishes with the guard that ran, and the release notes', async () => {
    publication.publishVersion.mockResolvedValue({
      doc: { expertiseId: SUBJECT_LINES },
      warnings: [],
    });

    const res = await request(makeApp())
      .post(versionRoute('activate'))
      .send({ guard: GUARD, changelog: 'Shorter' });

    expect(res.status).toBe(200);
    expect(publication.publishVersion).toHaveBeenCalledWith(
      {
        kind: 'expertise',
        id: SUBJECT_LINES,
        version: VERSION,
        guard: GUARD,
        payload: { changelog: 'Shorter', releaseNotes: undefined },
      },
      ADMIN
    );
    expect(res.body).toEqual({ expertiseId: SUBJECT_LINES });
  });

  // A publication is made on the condition that the draft did not change
  // since the page read it (ADR 0014), through the guard too.
  it('publishes with the update date of the draft the page read', async () => {
    publication.publishVersion.mockResolvedValue({
      doc: { expertiseId: SUBJECT_LINES },
      warnings: [],
    });
    const readAt = '2026-11-04T10:00:00.000Z';

    await request(makeApp())
      .post(versionRoute('activate'))
      .send({ guard: GUARD, updatedAt: readAt });

    expect(publication.publishVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ updatedAt: readAt }),
      }),
      ADMIN
    );
  });

  // The opening a publication asks for (ADR 0013) goes through the guard too.
  it("publishes a skill with its guard and its opening, and answers the opening's warnings", async () => {
    const opening = { code: 'OPEN_EXPERTISES_FAILED', expertiseIds: ['a.b'] };
    publication.publishVersion.mockResolvedValue({
      doc: { skillId: 'redaction.subject-ideas', versions: [] },
      warnings: [opening],
    });

    const res = await request(makeApp())
      .post('/api/ai-skills/redaction.subject-ideas/versions/1.3/activate')
      .send({ guard: GUARD, openToAll: true, openExpertiseIds: ['a.b'] });

    expect(res.status).toBe(200);
    expect(publication.publishVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'skill',
        guard: GUARD,
        payload: expect.objectContaining({
          openToAll: true,
          openExpertiseIds: ['a.b'],
        }),
      }),
      ADMIN
    );
    expect(res.body.warnings).toEqual([opening]);
  });

  it('asks for the guard, with what it would replay, when a feature uses the version', async () => {
    publication.publishVersion.mockRejectedValue(
      createError(409, 'SKILL_PUBLICATION_GUARD_REQUIRED', {
        usedBy: GUARD.usedBy,
        calls: 2,
        missing: ['redaction.preheader-ideas'],
      })
    );

    const res = await request(makeApp()).post(versionRoute('activate'));

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      message: 'SKILL_PUBLICATION_GUARD_REQUIRED',
      calls: 2,
      missing: ['redaction.preheader-ideas'],
    });
  });

  it('records a cancellation with the guard that ran', async () => {
    publication.cancelPublication.mockResolvedValue({
      expertiseId: SUBJECT_LINES,
    });

    await request(makeApp())
      .post(versionRoute('cancel-publication'))
      .send({ guard: GUARD });

    expect(publication.cancelPublication).toHaveBeenCalledWith(
      { kind: 'expertise', id: SUBJECT_LINES, version: VERSION, guard: GUARD },
      ADMIN
    );
  });

  it('is for super admins only', async () => {
    const res = await request(
      makeApp({ id: 'someone', role: 'regular_user' })
    ).post(versionRoute('guard'));

    expect(res.status).toBe(401);
    expect(publication.guardPublication).not.toHaveBeenCalled();
  });
});
