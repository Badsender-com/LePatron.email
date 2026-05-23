'use strict';

const asyncHandler = require('express-async-handler');
const expertiseService = require('../services/expertise.service.js');

function userIdOf(req) {
  return req.user && !req.user.isAdmin ? req.user.id : null;
}

module.exports = {
  listExpertise: asyncHandler(async (req, res) => {
    res.json(await expertiseService.listExpertise(req.query));
  }),

  getExpertise: asyncHandler(async (req, res) => {
    res.json(await expertiseService.getExpertise(req.params.expertiseId));
  }),

  createExpertise: asyncHandler(async (req, res) => {
    const exp = await expertiseService.createExpertise(req.body, userIdOf(req));
    res.status(201).json(exp);
  }),

  updateExpertise: asyncHandler(async (req, res) => {
    res.json(
      await expertiseService.updateExpertise(req.params.expertiseId, req.body)
    );
  }),

  createVersion: asyncHandler(async (req, res) => {
    const exp = await expertiseService.createVersion(
      req.params.expertiseId,
      req.body,
      userIdOf(req)
    );
    res.status(201).json(exp);
  }),

  updateVersion: asyncHandler(async (req, res) => {
    res.json(
      await expertiseService.updateVersion(
        req.params.expertiseId,
        req.params.versionNumber,
        req.body,
        userIdOf(req)
      )
    );
  }),

  activateVersion: asyncHandler(async (req, res) => {
    res.json(
      await expertiseService.activateVersion(
        req.params.expertiseId,
        req.params.versionNumber,
        req.body,
        userIdOf(req)
      )
    );
  }),

  archiveExpertise: asyncHandler(async (req, res) => {
    res.json(await expertiseService.archiveExpertise(req.params.expertiseId));
  }),
};
