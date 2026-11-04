'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const logger = require('../../utils/logger.js');

const skillService = require('../services/skill.service.js');
const { parseVersionParam } = require('../services/version-helpers.js');
const { listSchemaIds, missingSchemaIds } = require('../schemas');
const { describeSchema } = require('../schemas/describe-schema.js');
const { templateWarnings } = require('../services/template-coherence.js');
const { SkillNatures } = require('../constant/skill-constants.js');
const { assertCopy } = require('../services/skills-copy.service.js');
const { withUsedBy } = require('../services/skills-publication.service.js');

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

// The warning of a version naming a schema this instance's code lacks,
// worded by the interface under `aiSkills.warnings`.
const SCHEMA_NOT_IN_CODE = 'SCHEMA_NOT_IN_CODE';

// A skill as answered, each version naming the schemas this instance's code
// does not hold (`missingSchemaIds`), for the badge on such a draft.
function withMissingSchemas(skill) {
  const payload = typeof skill.toJSON === 'function' ? skill.toJSON() : skill;
  payload.versions = (payload.versions || []).map((version) => {
    const missing = missingSchemaIds(version);
    return missing.length ? { ...version, missingSchemaIds: missing } : version;
  });
  return payload;
}

// Serialize a skill and append non-blocking template↔schema coherence warnings
// for the given version (DRAFT save AND activation surface them). A task
// skill's version has neither template nor schema: nothing to warn about.
// Tolerant of a plain object so the service layer can be mocked in routing
// tests.
function withVersionWarnings(skill, major, minor) {
  const version = (skill.versions || []).find(
    (v) => v.versionMajor === major && v.versionMinor === minor
  );
  const payload = withMissingSchemas(skill);
  payload.warnings = [
    // A schema the code does not hold yet: the draft is saved, its
    // publication refused until the code ships (ADR 0019).
    ...(version ? missingSchemaIds(version) : []).map((schemaId) => ({
      code: SCHEMA_NOT_IN_CODE,
      schemaId,
    })),
    ...(version && version.nature === SkillNatures.TASK
      ? []
      : templateWarnings(
          version ? version.inputTemplate : '',
          version ? version.inputSchemaId : ''
        )),
  ];
  return payload;
}

// At publication, what the version's consumed expertises warn of too, with
// the audience the skill has now, and those of its opening. The publication
// is done: reading what it warns of never turns it into an error.
async function withPublicationWarnings(skill, major, minor, opening) {
  const payload = withVersionWarnings(skill, major, minor);
  const version = (skill.versions || []).find(
    (v) => v.versionMajor === major && v.versionMinor === minor
  );
  let consumed = [];
  try {
    consumed = await skillService.consumedExpertiseWarnings(skill, version);
  } catch (error) {
    logger.error(
      `[ai-skill] the warnings of ${skill.skillId} ${major}.${minor} could not be read`,
      error
    );
  }
  payload.warnings = [...payload.warnings, ...consumed, ...opening];
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
    // Worked out from the features' declarations, never stored (ADR 0019).
    res.json({
      ...data,
      items: (data.items || []).map((item) => withUsedBy('skill', item)),
    });
  }),

  getSkill: asyncHandler(async (req, res) => {
    const skill = await skillService.getSkill(req.params.skillId);
    res.json(withUsedBy('skill', withMissingSchemas(skill)));
  }),

  createSkill: asyncHandler(async (req, res) => {
    const skill = await skillService.createSkill(req.body, userIdOf(req));
    res.status(201).json(skill);
  }),

  // The skill saved, and what its opening warns of (ADR 0013).
  updateSkill: asyncHandler(async (req, res) => {
    const { skill, warnings } = await skillService.updateSkill(
      req.params.skillId,
      req.body
    );
    res.json({
      ...(typeof skill.toJSON === 'function' ? skill.toJSON() : skill),
      warnings,
    });
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
    // Keeping on the copy what is published is a copy's (ADR 0019).
    if ((req.body || {}).keepOnCopy === true) assertCopy();
    const { skill, warnings } = await skillService.activateVersion(
      req.params.skillId,
      { major, minor },
      req.body,
      userIdOf(req)
    );
    // Non-blocking coherence warnings surface post-activation too (e.g. a
    // schema that accepts expertises but a template that never inserts them),
    // with those of the expertises a task version consumes and of its opening.
    res.json(await withPublicationWarnings(skill, major, minor, warnings));
  }),

  getPlatformOnlyExpertises: asyncHandler(async (req, res) => {
    res.json({
      expertises: await skillService.versionPlatformOnlyExpertises(
        req.params.skillId,
        versionFromParam(req)
      ),
    });
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
