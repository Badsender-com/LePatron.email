'use strict';

const asyncHandler = require('express-async-handler');
const runService = require('../services/run.service.js');

function userIdOf(req) {
  return req.user && !req.user.isAdmin ? req.user.id : null;
}

module.exports = {
  listRuns: asyncHandler(async (req, res) => {
    res.json(
      await runService.listRunsForScenario(req.params.scenarioId, req.query)
    );
  }),

  getRun: asyncHandler(async (req, res) => {
    res.json(await runService.getRun(req.params.runId));
  }),

  setFeedback: asyncHandler(async (req, res) => {
    res.json(
      await runService.setRunFeedback(
        req.params.runId,
        req.body || {},
        userIdOf(req)
      )
    );
  }),

  markGolden: asyncHandler(async (req, res) => {
    res.json(await runService.markGolden(req.params.runId));
  }),

  unmarkGolden: asyncHandler(async (req, res) => {
    res.json(await runService.unmarkGolden(req.params.runId));
  }),

  deleteRun: asyncHandler(async (req, res) => {
    res.json(await runService.deleteRun(req.params.runId));
  }),
};
