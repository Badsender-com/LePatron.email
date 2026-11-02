'use strict';

const asyncHandler = require('express-async-handler');
const { isBootstrapAccount } = require('../../account/bootstrap-account.js');
const runService = require('../services/run.service.js');

function userIdOf(req) {
  // The bootstrap account has no document to own anything; a persisted
  // super admin owns what it creates like any user.
  return req.user && !isBootstrapAccount(req.user) ? req.user.id : null;
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
