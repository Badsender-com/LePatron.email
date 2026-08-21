'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');

const skillService = require('../services/skill.service.js');
const { parseVersionParam } = require('../services/version-helpers.js');
const { listSchemaIds } = require('../schemas');
const { describeSchema } = require('../schemas/describe-schema.js');
const { templateWarnings } = require('../services/template-coherence.js');

/**
 * Who is acting, for the `owner` / `createdBy` / `updatedBy` audit fields.
 *
 * The `!isAdmin` condition this replaces could never be true here: every route
 * of this module sits behind GUARD_ADMIN, which only lets through the account
 * whose `isAdmin` is truthy — and the only such account is the hardcoded
 * `adminUser` of auth.guard.js (UserSchema's `isAdmin` virtual returns false for
 * every database user). So the audit fields were persisted as null, always.
 *
 * Note the ceiling: since a single super-admin identity can reach these routes,
 * this records "the admin account", not which person acted. That is a property
 * of the project's super-admin auth, not of this function.
 */
function userIdOf(req) {
  return req.user ? req.user.id : null;
}

// Serialize a skill and append non-blocking template↔schema coherence warnings
// for the given version (DRAFT save AND activation surface them). Tolerant of a
// plain object so the service layer can be mocked in routing tests.
function withVersionWarnings(skill, major, minor) {
  const version = (skill.versions || []).find(
    (v) => v.versionMajor === major && v.versionMinor === minor
  );
  const payload = typeof skill.toJSON === 'function' ? skill.toJSON() : skill;
  payload.warnings = templateWarnings(
    version ? version.inputTemplate : '',
    version ? version.inputSchemaId : ''
  );
  return payload;
}

function versionFromParam(req) {
  const parsed = parseVersionParam(req.params.version);
  if (!parsed)
    throw createError(400, 'Invalid version format (expected "major.minor")');
  return parsed;
}

module.exports = {
  listSkills: asyncHandler(async (req, res) => {
    const data = await skillService.listSkills(req.query);
    res.json(data);
  }),

  getSkill: asyncHandler(async (req, res) => {
    const skill = await skillService.getSkill(req.params.skillId);
    res.json(skill);
  }),

  createSkill: asyncHandler(async (req, res) => {
    const skill = await skillService.createSkill(req.body, userIdOf(req));
    res.status(201).json(skill);
  }),

  updateSkill: asyncHandler(async (req, res) => {
    const skill = await skillService.updateSkill(req.params.skillId, req.body);
    res.json(skill);
  }),

  createMinorVersion: asyncHandler(async (req, res) => {
    const skill = await skillService.createMinorVersion(
      req.params.skillId,
      userIdOf(req)
    );
    res.status(201).json(skill);
  }),

  createMajorVersion: asyncHandler(async (req, res) => {
    const { sourceMajor, sourceMinor } = req.body || {};
    let source = null;
    if (sourceMajor !== undefined) {
      const sk = await skillService.getSkill(req.params.skillId);
      source = (sk.versions || []).find(
        (v) =>
          v.versionMajor === Number(sourceMajor) &&
          v.versionMinor === Number(sourceMinor || 0)
      );
    }
    const skill = await skillService.createMajorVersion(req.params.skillId, {
      source,
      userId: userIdOf(req),
    });
    res.status(201).json(skill);
  }),

  updateVersion: asyncHandler(async (req, res) => {
    const { major, minor } = versionFromParam(req);
    const skill = await skillService.updateVersion(
      req.params.skillId,
      { major, minor },
      req.body,
      userIdOf(req)
    );
    // Non-blocking coherence warnings on DRAFT save (additive response key):
    // the same unknown-field issue becomes a hard error at activation.
    res.json(withVersionWarnings(skill, major, minor));
  }),

  deleteVersion: asyncHandler(async (req, res) => {
    const skill = await skillService.deleteVersion(
      req.params.skillId,
      versionFromParam(req)
    );
    res.json(skill);
  }),

  activateVersion: asyncHandler(async (req, res) => {
    const { major, minor } = versionFromParam(req);
    const skill = await skillService.activateVersion(
      req.params.skillId,
      { major, minor },
      req.body,
      userIdOf(req)
    );
    // Non-blocking coherence warnings surface post-activation too (e.g. a
    // schema that accepts expertises but a template that never inserts them).
    res.json(withVersionWarnings(skill, major, minor));
  }),

  archiveSkill: asyncHandler(async (req, res) => {
    const skill = await skillService.archiveSkill(req.params.skillId);
    res.json(skill);
  }),

  listSchemas: asyncHandler(async (_req, res) => {
    res.json({ schemas: listSchemaIds() });
  }),

  getSchemaDescriptor: asyncHandler(async (req, res) => {
    const descriptor = describeSchema(req.params.schemaId);
    if (!descriptor) {
      throw createError(404, `Unknown schema "${req.params.schemaId}"`);
    }
    res.json(descriptor);
  }),
};
