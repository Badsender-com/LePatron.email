'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const expertiseService = require('../services/expertise.service.js');
const { parseVersionParam } = require('../services/version-helpers.js');

function userIdOf(req) {
  return req.user && !req.user.isAdmin ? req.user.id : null;
}

function versionFromParam(req) {
  const parsed = parseVersionParam(req.params.version);
  if (!parsed)
    throw createError(400, 'Invalid version format (expected "major.minor")');
  return parsed;
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

  createMinorVersion: asyncHandler(async (req, res) => {
    const exp = await expertiseService.createMinorVersion(
      req.params.expertiseId,
      userIdOf(req)
    );
    res.status(201).json(exp);
  }),

  createMajorVersion: asyncHandler(async (req, res) => {
    const { sourceMajor, sourceMinor } = req.body || {};
    let source = null;
    if (sourceMajor !== undefined) {
      const e = await expertiseService.getExpertise(req.params.expertiseId);
      source = (e.versions || []).find(
        (v) =>
          v.versionMajor === Number(sourceMajor) &&
          v.versionMinor === Number(sourceMinor || 0)
      );
    }
    const exp = await expertiseService.createMajorVersion(
      req.params.expertiseId,
      { source, userId: userIdOf(req) }
    );
    res.status(201).json(exp);
  }),

  updateVersion: asyncHandler(async (req, res) => {
    res.json(
      await expertiseService.updateVersion(
        req.params.expertiseId,
        versionFromParam(req),
        req.body,
        userIdOf(req)
      )
    );
  }),

  deleteVersion: asyncHandler(async (req, res) => {
    res.json(
      await expertiseService.deleteVersion(
        req.params.expertiseId,
        versionFromParam(req)
      )
    );
  }),

  activateVersion: asyncHandler(async (req, res) => {
    res.json(
      await expertiseService.activateVersion(
        req.params.expertiseId,
        versionFromParam(req),
        req.body,
        userIdOf(req)
      )
    );
  }),

  archiveExpertise: asyncHandler(async (req, res) => {
    res.json(await expertiseService.archiveExpertise(req.params.expertiseId));
  }),
};
