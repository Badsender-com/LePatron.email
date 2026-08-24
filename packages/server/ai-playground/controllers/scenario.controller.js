'use strict';

const asyncHandler = require('express-async-handler');

const scenarioService = require('../services/scenario.service.js');
const playgroundRunner = require('../services/playground-runner.service.js');
const expertiseRepo = require('../../ai-skill/repositories/expertise.repository.js');

function userIdOf(req) {
  return req.user && !req.user.isAdmin ? req.user.id : null;
}

module.exports = {
  listScenarios: asyncHandler(async (req, res) => {
    res.json(await scenarioService.listScenarios(req.query));
  }),

  getScenario: asyncHandler(async (req, res) => {
    res.json(await scenarioService.getScenario(req.params.scenarioId));
  }),

  getScenarioFacets: asyncHandler(async (_req, res) => {
    res.json(await scenarioService.getScenarioFacets());
  }),

  createScenario: asyncHandler(async (req, res) => {
    const scenario = await scenarioService.createScenario(
      req.body,
      userIdOf(req)
    );
    res.status(201).json(scenario);
  }),

  updateScenario: asyncHandler(async (req, res) => {
    res.json(
      await scenarioService.updateScenario(
        req.params.scenarioId,
        req.body,
        userIdOf(req)
      )
    );
  }),

  deleteScenario: asyncHandler(async (req, res) => {
    res.json(await scenarioService.deleteScenario(req.params.scenarioId));
  }),

  executeScenario: asyncHandler(async (req, res) => {
    const run = await playgroundRunner.executeScenario({
      scenarioId: req.params.scenarioId,
      userId: userIdOf(req),
      // `groupId` is deliberately NOT read from the body. No UI sends it, and
      // it selects which client group's integration — API key, budget — the
      // run spends, and which group's AISkillInvocation carries the prompt.
      // The runner falls back to scenario.groupContext then the platform
      // group. A runtime override is a step-2 concern and needs a whitelist.
      overrides: req.body && req.body.overrides,
    });
    // fieldErrors is a transient property outside the mongoose schema:
    // res.json(run) would prune it through toJSON(), so compose explicitly.
    // Only the immediate execute response carries it — later GETs of the run
    // fall back to the (humanized) errorMessage.
    const payload = run.toJSON();
    if (run.fieldErrors) payload.fieldErrors = run.fieldErrors;
    res.json(payload);
  }),

  previewExpertiseFilter: asyncHandler(async (req, res) => {
    // Accept the filter either in query (GET) or body (POST); GET is simpler
    // for the UI to call from the scenario form when the filter changes.
    const source = req.method === 'GET' ? req.query : req.body || {};
    const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
    const filter = {
      scope: toArray(source.scope),
      categories: toArray(source.categories),
      emailType: source.emailType || null,
      language: source.language || null,
    };
    // findApplicable throws 400 when scope OR categories is missing — the
    // preview must not silently return count 0 for an incomplete filter (§1.2).
    // resolveExpertise() swallows that case (correct for the runner, wrong here).
    const matches = await expertiseRepo.findApplicable(filter);
    // The count must reflect every response, even two identical ones — kill the
    // 304 conditional-GET that froze the UI (§1.3).
    res.set('Cache-Control', 'no-store');
    res.json({
      count: matches.length,
      items: matches.map((m) => ({
        expertiseId: m.expertiseId,
        title: m.title,
        versionMajor: m.versionMajor,
        versionMinor: m.versionMinor,
      })),
    });
  }),
};
