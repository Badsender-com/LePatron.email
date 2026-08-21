'use strict';

const createError = require('http-errors');
const { LePatronSkills } = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const { SkillStatuses } = require('../constant/skill-constants.js');
const { versionLabel } = require('./version-helpers.js');
const { validateTemplateCoherence } = require('./template-coherence.js');
const {
  createVersionedEntityService,
} = require('./versioned-entity.service.js');

const LIST_PROJECTION = {
  skillId: 1,
  title: 1,
  description: 1,
  category: 1,
  status: 1,
  activeVersion: 1,
  owner: 1,
  createdAt: 1,
  updatedAt: 1,
};

async function listSkills({ category, status, page = 1, pageSize = 50 } = {}) {
  const query = {};
  if (category) query.category = category;
  if (status) query.status = status;
  const limit = Math.min(Math.max(parseInt(pageSize, 10) || 50, 1), 200);
  const skip = Math.max((parseInt(page, 10) || 1) - 1, 0) * limit;
  const [items, total] = await Promise.all([
    LePatronSkills.find(query, LIST_PROJECTION)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LePatronSkills.countDocuments(query),
  ]);
  return { items, total, page: Math.floor(skip / limit) + 1, pageSize: limit };
}

// Delegated to the shared lifecycle (see `versioned` below) so the lookup and
// its 404 stay identical across both versioned entities.
function getSkill(skillId) {
  return versioned.getDoc(skillId);
}

// Every new skill starts on the generic text contract: the author iterates
// without picking a schema up front, and the coherence gate has something to
// validate the template against from day one. Switching to a typed schema is
// a later, deliberate move (via a new major version).
const DEFAULT_INPUT_SCHEMA_ID = 'genericTextInput';
const DEFAULT_OUTPUT_SCHEMA_ID = 'genericTextOutput';

async function createSkill(data, userId) {
  const now = new Date();
  const payload = {
    skillId: data.skillId,
    title: data.title,
    description: data.description || '',
    category: data.category,
    owner: userId,
    status: SkillStatuses.DRAFT,
    activeVersion: { major: null, minor: 0 },
    // Seed a v1.0 DRAFT with the generic schemas pre-filled (§B1).
    versions: [
      {
        versionMajor: 1,
        versionMinor: 0,
        status: 'DRAFT',
        ...blankVersionContent(),
        inputSchemaId: DEFAULT_INPUT_SCHEMA_ID,
        outputSchemaId: DEFAULT_OUTPUT_SCHEMA_ID,
        changelog: '',
        releaseNotes: '',
        createdBy: userId,
        createdAt: now,
        updatedBy: userId,
        updatedAt: now,
      },
    ],
  };
  try {
    return await LePatronSkills.create(payload);
  } catch (err) {
    if (err && err.code === 11000) {
      throw createError(409, `skillId "${data.skillId}" already exists`);
    }
    throw err;
  }
}

// Schemas are NOT here anymore — they live on the version and are edited via
// updateVersion (DRAFT only), like the prompts.
const PATCHABLE_FIELDS = ['title', 'description', 'category'];

async function updateSkill(skillId, patch) {
  const skill = await getSkill(skillId);
  for (const key of PATCHABLE_FIELDS) {
    if (patch[key] !== undefined) skill[key] = patch[key];
  }
  await skill.save();
  return skill;
}

// ─── Versioning ────────────────────────────────────────────────────────────

// Single source of truth for the content fields of a version — the fields
// that a new version inherits from its source (as opposed to metadata like
// versionMajor/status/changelog/timestamps, which are set per creation).
//
// EVERY copy path (minor, major, duplicate) and the blank seed derive their
// field list from here, and so does the generic non-regression test. Adding a
// content field to the version model? Add it here — the copy and its test move
// together, so a field can never again be silently dropped from cloning (the
// bug that left inputSchemaId/outputSchemaId empty after the §3 migration, and
// the "empty system prompt" false alarm before it).
//
// `deep: true` marks fields that must be structurally cloned (objects/arrays);
// the rest are primitives copied by value. `default` yields a fresh empty value
// when the source lacks the field.
const VERSION_CONTENT_FIELDS = [
  { name: 'systemPrompt', default: () => '' },
  { name: 'skillBody', default: () => '' },
  { name: 'inputTemplate', default: () => '' },
  { name: 'inputSchemaId', default: () => '' },
  { name: 'outputSchemaId', default: () => '' },
  { name: 'modelHints', default: () => ({}), deep: true },
  { name: 'testCases', default: () => [], deep: true },
];

/**
 * Publication gate specific to skills. Expertises have no equivalent, which is
 * exactly why it is injected rather than living in the shared lifecycle.
 */
function assertSkillPublishable(version) {
  // Schemas are required to publish (they may be empty on a DRAFT).
  if (!version.inputSchemaId || !version.outputSchemaId) {
    throw createError(400, ERROR_CODES.SKILL_SCHEMAS_REQUIRED_TO_PUBLISH);
  }

  // With strict input schemas, an out-of-schema placeholder is ALWAYS
  // interpolated empty — a guaranteed bug, so activation is blocked.
  // (A required field missing from the template stays a DRAFT-save warning:
  // omitting it can be intentional.)
  const { unknownFields } = validateTemplateCoherence(
    version.inputTemplate,
    version.inputSchemaId
  );
  if (unknownFields.length) {
    // The offending fields travel as data, not inside the message: the global
    // error handler spreads own properties into the response, so the UI can
    // build the sentence in the user's language.
    throw createError(400, ERROR_CODES.SKILL_TEMPLATE_UNKNOWN_FIELDS, {
      schemaId: version.inputSchemaId,
      fields: unknownFields,
    });
  }
}

// The versioning state machine itself lives in versioned-entity.service.js,
// shared with expertise (review A1). Only the skill specifics are configured
// here: the content fields and the publication gate above.
const versioned = createVersionedEntityService({
  model: LePatronSkills,
  entityLabel: 'Skill',
  entityNoun: 'skill',
  idField: 'skillId',
  contentFields: VERSION_CONTENT_FIELDS,
  activationGate: assertSkillPublishable,
});

const {
  blankVersionContent,
  createMinorVersion,
  createMajorVersion,
  updateVersion,
  deleteVersion,
  activateVersion,
} = versioned;

const archiveSkill = versioned.archive;

module.exports = {
  VERSION_CONTENT_FIELDS,
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  createMinorVersion,
  createMajorVersion,
  updateVersion,
  deleteVersion,
  activateVersion,
  archiveSkill,
  versionLabel,
};
