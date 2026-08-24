'use strict';

const asyncHandler = require('express-async-handler');

const scenarioService = require('../services/scenario.service.js');
const playgroundRunner = require('../services/playground-runner.service.js');
const expertiseResolver = require('../services/expertise-resolver.service.js');

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
    // The count must reflect every response, even two identical ones — kill the
    // 304 conditional-GET that froze the UI (§1.3).
    res.set('Cache-Control', 'no-store');
    res.json(await expertiseResolver.previewFilter(req.query));
  }),
};
