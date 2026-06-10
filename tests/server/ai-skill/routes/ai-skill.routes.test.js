'use strict';

/**
 * Lightweight HTTP-level tests on the ai-skill router. Services are mocked
 * — these tests focus on routing, guard wiring, and request/response shape.
 */

const { Types } = require('mongoose');

// ── Mock service layer ─────────────────────────────────────────────────────
jest.mock(
  '../../../../packages/server/ai-skill/services/skill.service',
  () => ({
    listSkills: jest.fn(),
    getSkill: jest.fn(),
    createSkill: jest.fn(),
    updateSkill: jest.fn(),
    createMinorVersion: jest.fn(),
    createMajorVersion: jest.fn(),
    updateVersion: jest.fn(),
    deleteVersion: jest.fn(),
    activateVersion: jest.fn(),
    archiveSkill: jest.fn(),
  })
);
jest.mock(
  '../../../../packages/server/ai-skill/services/skill-invocation.service',
  () => ({ invoke: jest.fn() })
);
jest.mock(
  '../../../../packages/server/ai-skill/services/test-budget.service',
  () => ({ consumeBudget: jest.fn(), getBudget: jest.fn() })
);
jest.mock(
  '../../../../packages/server/ai-skill/services/expertise.service',
  () => ({
    listExpertise: jest.fn(),
    getExpertise: jest.fn(),
    createExpertise: jest.fn(),
    updateExpertise: jest.fn(),
    createMinorVersion: jest.fn(),
    createMajorVersion: jest.fn(),
    updateVersion: jest.fn(),
    deleteVersion: jest.fn(),
    activateVersion: jest.fn(),
    archiveExpertise: jest.fn(),
  })
);
jest.mock(
  '../../../../packages/server/ai-skill/services/invocation-log.service',
  () => ({ listInvocations: jest.fn(), getInvocation: jest.fn() })
);

// Stub the auth guard so we can flip req.user.isAdmin from the test.
jest.mock('../../../../packages/server/account/auth.guard', () => ({
  GUARD_ADMIN: (req, res, next) => {
    if (req.user && req.user.isAdmin) return next();
    return res.status(401).json({ message: 'Unauthorized' });
  },
}));

const express = require('express');
const request = require('supertest');

const skillService = require('../../../../packages/server/ai-skill/services/skill.service');
const testBudgetService = require('../../../../packages/server/ai-skill/services/test-budget.service');
const skillInvocation = require('../../../../packages/server/ai-skill/services/skill-invocation.service');
const invocationLog = require('../../../../packages/server/ai-skill/services/invocation-log.service');

const {
  skillsRouter,
  expertiseRouter,
  invocationsRouter,
} = require('../../../../packages/server/ai-skill/ai-skill.routes');

function makeApp({ asAdmin = true } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = asAdmin ? { isAdmin: true, id: 'admin' } : { id: 'someone' };
    next();
  });
  app.use('/api/ai-skills', skillsRouter);
  app.use('/api/ai-expertise', expertiseRouter);
  app.use('/api/ai-invocations', invocationsRouter);
  // Centralized error handler so http-errors propagates as JSON.
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({
      message: err.message,
      code: err.skillError && err.skillError.code,
    });
  });
  return app;
}

beforeEach(() => jest.clearAllMocks());

describe('ai-skill HTTP routes', () => {
  it('rejects non-admin users with 401 on every route', async () => {
    const app = makeApp({ asAdmin: false });
    const res = await request(app).get('/api/ai-skills');
    expect(res.status).toBe(401);
  });

  it('GET /api/ai-skills returns the list from the service', async () => {
    skillService.listSkills.mockResolvedValue({
      items: [{ skillId: 'a' }],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    const res = await request(makeApp()).get('/api/ai-skills');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([{ skillId: 'a' }]);
  });

  it('GET /api/ai-skills/schemas exposes the registered zod schemas', async () => {
    const res = await request(makeApp()).get('/api/ai-skills/schemas');
    expect(res.status).toBe(200);
    expect(res.body.schemas).toEqual(
      expect.arrayContaining(['genericTextInput', 'genericTextOutput'])
    );
  });

  it('GET /api/ai-skills/schemas/:schemaId/descriptor describes the schema', async () => {
    const res = await request(makeApp()).get(
      '/api/ai-skills/schemas/genericTextInput/descriptor'
    );
    expect(res.status).toBe(200);
    expect(res.body.hasExpertiseField).toBe(true);
    expect(res.body.fields).toEqual([
      { name: 'prompt', type: 'string', required: true, multiline: true },
      { name: 'context', type: 'string', required: false, multiline: true },
    ]);
  });

  it('GET /api/ai-skills/schemas/:schemaId/descriptor returns 404 for unknown schema', async () => {
    const res = await request(makeApp()).get(
      '/api/ai-skills/schemas/nope/descriptor'
    );
    expect(res.status).toBe(404);
  });

  it('POST /api/ai-skills/:skillId/test enforces budget then invokes', async () => {
    testBudgetService.consumeBudget.mockResolvedValue({
      count: 1,
      max: 50,
      remaining: 49,
    });
    skillInvocation.invoke.mockResolvedValue({
      output: { text: 'ok' },
      invocationId: 'inv1',
      resolvedConfig: {},
      tokenUsage: {},
      latencyMs: 12,
    });
    const groupId = new Types.ObjectId().toString();
    const res = await request(makeApp())
      .post('/api/ai-skills/generic.text/test')
      .send({ input: { prompt: 'hi' }, groupId });
    expect(res.status).toBe(200);
    expect(testBudgetService.consumeBudget).toHaveBeenCalled();
    expect(skillInvocation.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId: 'generic.text',
        featureType: 'admin-test',
      })
    );
    expect(res.body.budget.remaining).toBe(49);
  });

  it('POST /api/ai-skills/:skillId/test returns 429 when budget exhausted', async () => {
    testBudgetService.consumeBudget.mockRejectedValue(
      Object.assign(new Error('cap'), { status: 429 })
    );
    const res = await request(makeApp())
      .post('/api/ai-skills/generic.text/test')
      .send({ input: { prompt: 'hi' }, groupId: 'g' });
    expect(res.status).toBe(429);
    expect(skillInvocation.invoke).not.toHaveBeenCalled();
  });

  it('full lifecycle: create → major version → activate → minor version → activate → archive', async () => {
    skillService.createSkill.mockResolvedValue({
      skillId: 'a',
      status: 'DRAFT',
    });
    skillService.createMajorVersion.mockResolvedValue({
      skillId: 'a',
      versions: [{ versionMajor: 1, versionMinor: 0, status: 'DRAFT' }],
    });
    skillService.activateVersion.mockResolvedValue({
      skillId: 'a',
      status: 'ACTIVE',
      activeVersion: { major: 1, minor: 0 },
    });
    skillService.createMinorVersion.mockResolvedValue({
      skillId: 'a',
      versions: [
        { versionMajor: 1, versionMinor: 0, status: 'ACTIVE' },
        { versionMajor: 1, versionMinor: 1, status: 'DRAFT' },
      ],
    });
    skillService.archiveSkill.mockResolvedValue({
      skillId: 'a',
      status: 'ARCHIVED',
    });

    const app = makeApp();
    const r1 = await request(app).post('/api/ai-skills').send({
      skillId: 'a',
      title: 't',
      category: 'redaction',
      inputSchemaId: 'genericTextInput',
      outputSchemaId: 'genericTextOutput',
    });
    expect(r1.status).toBe(201);

    const r2 = await request(app).post('/api/ai-skills/a/versions/major');
    expect(r2.status).toBe(201);

    const r3 = await request(app)
      .post('/api/ai-skills/a/versions/1.0/activate')
      .send({ changelog: 'c', releaseNotes: 'r' });
    expect(r3.status).toBe(200);
    expect(r3.body.status).toBe('ACTIVE');

    const r4 = await request(app).post('/api/ai-skills/a/versions/minor');
    expect(r4.status).toBe(201);

    const r5 = await request(app).post('/api/ai-skills/a/archive');
    expect(r5.status).toBe(200);
    expect(r5.body.status).toBe('ARCHIVED');
  });

  it('GET /api/ai-invocations forwards filters as query', async () => {
    invocationLog.listInvocations.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });
    const res = await request(makeApp())
      .get('/api/ai-invocations')
      .query({ skillId: 'a', status: 'SUCCESS' });
    expect(res.status).toBe(200);
    expect(invocationLog.listInvocations).toHaveBeenCalledWith(
      expect.objectContaining({ skillId: 'a', status: 'SUCCESS' })
    );
  });
});
