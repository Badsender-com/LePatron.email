'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const expertiseService = require('../services/expertise.service.js');
const { parseVersionParam } = require('../services/version-helpers.js');
const { openTaskSkillsConsuming } = require('../services/audience-opening.js');
const { assertCopy } = require('../services/skills-copy.service.js');
const { withUsedBy } = require('../services/feature-use.js');
const { expertisePublication } = require('./publication.controller.js');

/**
 * Who is acting, for the `owner` / `createdBy` / `updatedBy` audit fields.
 *
 * Every route of this module sits behind GUARD_ADMIN: the actor is a super
 * admin, either a persisted one (ADR 0002), whose id names the person, or the
 * bootstrap account, whose configured id names "the bootstrap account".
 */
function userIdOf(req) {
  return req.user ? req.user.id : null;
}

function versionFromParam(req) {
  const parsed = parseVersionParam(req.params.version);
  if (!parsed)
    throw createError(400, 'Invalid version format (expected "major.minor")');
  return parsed;
}

module.exports = {
  listExpertise: asyncHandler(async (req, res) => {
    const data = await expertiseService.listExpertise(req.query);
    // Worked out from the features' declarations, never stored (ADR 0019).
    res.json({
      ...data,
      items: (data.items || []).map((item) => withUsedBy('expertise', item)),
    });
  }),

  getExpertise: asyncHandler(async (req, res) => {
    res.json(
      withUsedBy(
        'expertise',
        await expertiseService.getExpertise(req.params.expertiseId)
      )
    );
  }),

  getActivationImpact: asyncHandler(async (req, res) => {
    res.json({
      matches: await expertiseService.getActivationImpact(
        req.params.expertiseId
      ),
    });
  }),

  getOpenTaskSkills: asyncHandler(async (req, res) => {
    res.json({
      skills: await openTaskSkillsConsuming(req.params.expertiseId),
    });
  }),

  getFacets: asyncHandler(async (_req, res) => {
    res.json(await expertiseService.getFacets());
  }),

  createExpertise: asyncHandler(async (req, res) => {
    const exp = await expertiseService.createExpertise(req.body, userIdOf(req));
    res.status(201).json(exp);
  }),

  updateExpertise: asyncHandler(async (req, res) => {
    // The scope and the category decide which features load it: what that
    // changes warns, without a replay (ADR 0019).
    const { expertise, warnings } = await expertiseService.updateExpertise(
      req.params.expertiseId,
      req.body,
      { userId: userIdOf(req) }
    );
    res.json({ ...withUsedBy('expertise', expertise), warnings });
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

  // Through the publication guard when a feature uses the version (ADR 0019).
  activateVersion: asyncHandler(async (req, res) => {
    // Keeping on the copy what is published is a copy's (ADR 0019).
    if ((req.body || {}).keepOnCopy === true) assertCopy();
    const { doc } = await expertisePublication.publish(req);
    res.json(doc);
  }),

  // A feature that loads it stops: that warns, and is kept (ADR 0019).
  archiveExpertise: asyncHandler(async (req, res) => {
    const { expertise, warnings } = await expertiseService.archiveExpertise(
      req.params.expertiseId,
      { userId: userIdOf(req) }
    );
    res.json({ ...withUsedBy('expertise', expertise), warnings });
  }),
};
