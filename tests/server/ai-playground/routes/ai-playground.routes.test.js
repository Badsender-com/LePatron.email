'use strict';

const { Types } = require('mongoose');

jest.mock(
  '../../../../packages/server/ai-playground/services/scenario.service',
  () => ({
    listScenarios: jest.fn(),
    getScenario: jest.fn(),
    createScenario: jest.fn(),
    updateScenario: jest.fn(),
    deleteScenario: jest.fn(),
  })
);
jest.mock(
  '../../../../packages/server/ai-playground/services/playground-runner.service',
  () => ({ executeScenario: jest.fn() })
);
jest.mock(
  '../../../../packages/server/ai-playground/services/expertise-resolver.service',
  () => ({ resolveExpertise: jest.fn() })
);
jest.mock(
  '../../../../packages/server/ai-playground/services/run.service',
  () => ({
    listRunsForScenario: jest.fn(),
    getRun: jest.fn(),
    setRunFeedback: jest.fn(),
    markGolden: jest.fn(),
    unmarkGolden: jest.fn(),
    deleteRun: jest.fn(),
  })
);
jest.mock('../../../../packages/server/account/auth.guard', () => ({
  GUARD_ADMIN: (req, res, next) => {
    if (req.user && req.user.isAdmin) return next();
    return res.status(401).json({ message: 'Unauthorized' });
  },
}));

const express = require('express');
const request = require('supertest');

const scenarioService = require('../../../../packages/server/ai-playground/services/scenario.service');
const playgroundRunner = require('../../../../packages/server/ai-playground/services/playground-runner.service');
const {
  resolveExpertise,
} = require('../../../../packages/server/ai-playground/services/expertise-resolver.service');
const runService = require('../../../../packages/server/ai-playground/services/run.service');

const router = require('../../../../packages/server/ai-playground/ai-playground.routes');

function makeApp({ asAdmin = true } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = asAdmin ? { isAdmin: true, id: 'admin' } : { id: 'someone' };
    next();
  });
  app.use('/api/ai-playground', router);
  // Surface http-errors as JSON.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return app;
}

beforeEach(() => jest.clearAllMocks());

describe('ai-playground HTTP routes', () => {
  it('rejects non-admin users with 401', async () => {
    const app = makeApp({ asAdmin: false });
    const res = await request(app).get('/api/ai-playground/scenarios');
    expect(res.status).toBe(401);
  });

  it('GET /scenarios proxies to scenarioService.listScenarios', async () => {
    scenarioService.listScenarios.mockResolvedValue({
      items: [{ scenarioId: 'a' }],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    const res = await request(makeApp())
      .get('/api/ai-playground/scenarios')
      .query({ skillId: 'generic.text' });
    expect(res.status).toBe(200);
    expect(scenarioService.listScenarios).toHaveBeenCalledWith(
      expect.objectContaining({ skillId: 'generic.text' })
    );
  });

  it('POST /scenarios creates and returns 201', async () => {
    scenarioService.createScenario.mockResolvedValue({ scenarioId: 'a' });
    const res = await request(makeApp())
      .post('/api/ai-playground/scenarios')
      .send({ scenarioId: 'a', name: 'A', skillRef: { skillId: 'g' } });
    expect(res.status).toBe(201);
    expect(scenarioService.createScenario).toHaveBeenCalled();
  });

  // The runner returns a mongoose doc — the controller relies on toJSON().
  function mockRunDoc(doc) {
    return {
      ...doc,
      toJSON() {
        const json = { ...this };
        delete json.toJSON;
        delete json.fieldErrors;
        return json;
      },
    };
  }

  it('POST /scenarios/:id/execute calls the runner with body overrides', async () => {
    playgroundRunner.executeScenario.mockResolvedValue(
      mockRunDoc({ _id: new Types.ObjectId(), status: 'SUCCESS' })
    );
    const groupId = new Types.ObjectId().toString();
    const res = await request(makeApp())
      .post('/api/ai-playground/scenarios/demo/execute')
      .send({ groupId, overrides: { input: { prompt: 'override' } } });
    expect(res.status).toBe(200);
    expect(playgroundRunner.executeScenario).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarioId: 'demo',
        groupId,
        overrides: { input: { prompt: 'override' } },
      })
    );
  });

  it('POST /scenarios/:id/execute exposes transient fieldErrors in the payload', async () => {
    playgroundRunner.executeScenario.mockResolvedValue(
      mockRunDoc({
        _id: new Types.ObjectId(),
        status: 'VALIDATION_ERROR',
        errorMessage: 'Champs invalides : prompt (obligatoire)',
        fieldErrors: [{ field: 'prompt', issue: 'required' }],
      })
    );
    const res = await request(makeApp()).post(
      '/api/ai-playground/scenarios/demo/execute'
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('VALIDATION_ERROR');
    expect(res.body.fieldErrors).toEqual([
      { field: 'prompt', issue: 'required' },
    ]);
  });

  it('full lifecycle: create → execute → mark-golden → unmark-golden → delete', async () => {
    scenarioService.createScenario.mockResolvedValue({ scenarioId: 'demo' });
    playgroundRunner.executeScenario.mockResolvedValue(
      mockRunDoc({ _id: 'run-1', status: 'SUCCESS' })
    );
    runService.markGolden.mockResolvedValue({ _id: 'run-1', isGolden: true });
    runService.unmarkGolden.mockResolvedValue({
      _id: 'run-1',
      isGolden: false,
    });
    runService.deleteRun.mockResolvedValue({ deleted: true });
    scenarioService.deleteScenario.mockResolvedValue({ deleted: true });

    const app = makeApp();
    const r1 = await request(app)
      .post('/api/ai-playground/scenarios')
      .send({ scenarioId: 'demo', name: 'D', skillRef: { skillId: 'g' } });
    expect(r1.status).toBe(201);

    const r2 = await request(app).post(
      '/api/ai-playground/scenarios/demo/execute'
    );
    expect(r2.status).toBe(200);

    const r3 = await request(app).post(
      '/api/ai-playground/runs/run-1/mark-golden'
    );
    expect(r3.body.isGolden).toBe(true);

    const r4 = await request(app).post(
      '/api/ai-playground/runs/run-1/unmark-golden'
    );
    expect(r4.body.isGolden).toBe(false);

    const r5 = await request(app).delete('/api/ai-playground/scenarios/demo');
    expect(r5.body.deleted).toBe(true);
  });

  it('GET /preview-expertise-filter forwards filter and returns count + items', async () => {
    resolveExpertise.mockResolvedValue([
      { expertiseId: 'a', title: 'A', versionMajor: 1, versionMinor: 0 },
      { expertiseId: 'b', title: 'B', versionMajor: 2, versionMinor: 1 },
    ]);
    const res = await request(makeApp())
      .get('/api/ai-playground/preview-expertise-filter')
      .query({ scope: 'cta', emailType: 'promo' });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.items[0].expertiseId).toBe('a');
    expect(resolveExpertise).toHaveBeenCalledWith({
      expertiseRefs: [],
      expertiseFilter: {
        scope: ['cta'],
        emailType: 'promo',
        language: null,
      },
    });
  });

  it('PATCH /runs/:id/feedback persists rating + comment', async () => {
    runService.setRunFeedback.mockResolvedValue({
      _id: 'run-1',
      feedback: { rating: 'positive' },
    });
    const res = await request(makeApp())
      .patch('/api/ai-playground/runs/run-1/feedback')
      .send({ rating: 'positive', score: 5, comment: 'great' });
    expect(res.status).toBe(200);
    expect(runService.setRunFeedback).toHaveBeenCalledWith(
      'run-1',
      { rating: 'positive', score: 5, comment: 'great' },
      // userIdOf() returns null for the admin pseudo-user.
      null
    );
  });
});
