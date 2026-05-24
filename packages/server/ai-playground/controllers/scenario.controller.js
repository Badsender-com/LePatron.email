'use strict';

const asyncHandler = require('express-async-handler');

const scenarioService = require('../services/scenario.service.js');
const playgroundRunner = require('../services/playground-runner.service.js');
const {
  resolveExpertise,
} = require('../services/expertise-resolver.service.js');

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
      groupId: req.body && req.body.groupId,
      overrides: req.body && req.body.overrides,
    });
    res.json(run);
  }),

  previewExpertiseFilter: asyncHandler(async (req, res) => {
    // Accept the filter either in query (GET) or body (POST); GET is simpler
    // for the UI to call from the scenario form when the filter changes.
    const source = req.method === 'GET' ? req.query : req.body || {};
    const filter = {
      scope: Array.isArray(source.scope)
        ? source.scope
        : source.scope
        ? [source.scope]
        : [],
      emailType: source.emailType || null,
      language: source.language || null,
    };
    const matches = await resolveExpertise({
      expertiseRefs: [],
      expertiseFilter: filter,
    });
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
