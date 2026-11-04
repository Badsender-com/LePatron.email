'use strict';

const createError = require('http-errors');
const { pick } = require('lodash');
const { LePatronSkills } = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const {
  SkillStatuses,
  SkillNatures,
  Audiences,
} = require('../constant/skill-constants.js');
const {
  versionLabel,
  findVersion,
  findActiveVersion,
} = require('./version-helpers.js');
const { validateTemplateCoherence } = require('./template-coherence.js');
const { missingSchemaIds } = require('../schemas');
const { idsUsedByFeatures } = require('./skills-publication.service.js');
const { assertTestCases } = require('./test-cases.js');
const {
  assertConsumedExpertises,
  consumedExpertiseWarnings,
  platformOnlyExpertises,
} = require('./consumed-expertises.js');
const { assertOpenable, openExpertises } = require('./audience-opening.js');
const {
  createVersionedEntityService,
} = require('./versioned-entity.service.js');

const LIST_PROJECTION = {
  skillId: 1,
  title: 1,
  description: 1,
  category: 1,
  status: 1,
  audience: 1,
  servedToAssistants: 1,
  activeVersion: 1,
  // Where it comes from, on a copy (ADR 0019).
  followedAt: 1,
  keptOnCopy: 1,
  copiedFrom: 1,
  owner: 1,
  createdAt: 1,
  updatedAt: 1,
  // Only what tells the active version apart and what it consumes, never the
  // content of the history.
  'versions.versionMajor': 1,
  'versions.versionMinor': 1,
  'versions.nature': 1,
  'versions.consumedExpertiseIds': 1,
};

// A skill of the list: its active version carries its nature and the
// expertises it consumes, which the export bar shows (ADR 0018); the
// versions stay out.
function listItemOf({ versions, ...skill }) {
  const active = findActiveVersion({ ...skill, versions });
  if (!active) return skill;
  return {
    ...skill,
    activeVersion: {
      ...skill.activeVersion,
      nature: active.nature,
      consumedExpertiseIds: active.consumedExpertiseIds || [],
    },
  };
}

async function listSkills({
  category,
  status,
  usedByFeature,
  page = 1,
  pageSize = 50,
} = {}) {
  const query = {};
  if (category) query.category = category;
  if (status) query.status = status;
  // Worked out from the features' declarations (ADR 0019), before paging.
  if (String(usedByFeature) === 'true') {
    query.skillId = { $in: await idsUsedByFeatures('skill') };
  }
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
  return {
    items: items.map(listItemOf),
    total,
    page: Math.floor(skip / limit) + 1,
    pageSize: limit,
  };
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

/**
 * A new skill, with its v1.0 draft, in one write: nothing is stored when any
 * of it is refused, the consumed expertises checked first and the version
 * by the schema.
 *
 * @param {Object} data the skill's fields (skillId, title, description,
 *   category); never its audience, which is the platform company's
 * @param {*} userId
 * @param {Object} [firstVersion] what the v1.0 draft holds besides the
 *   defaults, among its patchable fields (the nature, the procedure, the
 *   consumed expertises, the changelog…)
 * @param {Object} [options]
 * @param {Object} [options.initialVersion] replaces the v1.0 draft: an
 *   imported version, at its own number, written with the document in one
 *   go (ADR 0018)
 * @returns {Promise<Object>} the skill
 * @throws {HttpError} 409 when the skillId exists, 400 when the version is
 *   refused
 */
async function createSkill(
  data,
  userId,
  firstVersion = {},
  { initialVersion } = {}
) {
  if (firstVersion.consumedExpertiseIds !== undefined) {
    await assertConsumedExpertises(firstVersion.consumedExpertiseIds);
  }
  const now = new Date();
  const payload = {
    skillId: data.skillId,
    title: data.title,
    description: data.description || '',
    category: data.category,
    // Explicit rather than left to the schema, and never taken from the
    // request: a new skill reaches the platform company only, until it is
    // opened, an act of its own (ADR 0013).
    audience: Audiences.PLATFORM,
    // Not served to assistants until someone decides it (ADR 0013).
    servedToAssistants: false,
    owner: userId,
    status: SkillStatuses.DRAFT,
    activeVersion: { major: null, minor: 0 },
    // Seed a v1.0 DRAFT with the generic schemas pre-filled (§B1).
    versions: [
      initialVersion
        ? versioned.importedDraft(initialVersion, userId)
        : {
            versionMajor: 1,
            versionMinor: 0,
            status: 'DRAFT',
            ...blankVersionContent(),
            inputSchemaId: DEFAULT_INPUT_SCHEMA_ID,
            outputSchemaId: DEFAULT_OUTPUT_SCHEMA_ID,
            changelog: '',
            releaseNotes: '',
            ...pick(firstVersion, versioned.PATCHABLE_VERSION_FIELDS),
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

// Schemas and the nature are NOT here — they live on the version and are
// edited via updateVersion (DRAFT only), like the prompts.
const PATCHABLE_FIELDS = [
  'title',
  'description',
  'category',
  'audience',
  'servedToAssistants',
];

/**
 * Everything is checked before anything is written; the skill saved, the
 * expertises chosen open with it, and a failure to open them is a warning.
 *
 * @param {string} skillId
 * @param {Object} patch the PATCHABLE_FIELDS to set, and `openExpertiseIds`:
 *   expertises the active version consumes kept to the platform company,
 *   opened to every company with the skill when the patch opens it too
 *   (ADR 0013)
 * @returns {Promise<{skill: Object, warnings: Object[]}>} the skill, and the
 *   warnings of its opening
 */
async function updateSkill(skillId, patch) {
  const skill = await getSkill(skillId);
  const opened = await assertOpenable(
    findActiveVersion(skill),
    patch.openExpertiseIds,
    patch.audience === Audiences.ALL
  );
  for (const key of PATCHABLE_FIELDS) {
    if (patch[key] !== undefined) skill[key] = patch[key];
  }
  await skill.save();
  return { skill, warnings: await openExpertises(opened, skillId) };
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
  { name: 'nature', default: () => SkillNatures.FEATURE },
  { name: 'systemPrompt', default: () => '' },
  { name: 'skillBody', default: () => '' },
  { name: 'inputTemplate', default: () => '' },
  { name: 'inputSchemaId', default: () => '' },
  { name: 'outputSchemaId', default: () => '' },
  { name: 'modelHints', default: () => ({}), deep: true },
  { name: 'testCases', default: () => [], deep: true },
  { name: 'procedure', default: () => '' },
  { name: 'consumedExpertiseIds', default: () => [], deep: true },
];

/**
 * Publication gate specific to skills. Expertises have no equivalent, which is
 * exactly why it is injected rather than living in the shared lifecycle.
 */
async function assertSkillPublishable(version) {
  // A draft may name a schema this instance's code does not hold yet
  // (ADR 0019); a published version may not, whatever its nature.
  const [missing] = missingSchemaIds(version);
  if (missing) {
    throw createError(400, ERROR_CODES.SKILL_SCHEMA_NOT_IN_CODE, {
      schemaId: missing,
    });
  }
  // Checked at save too; checked again here, on what is about to be served.
  await assertConsumedExpertises(version.consumedExpertiseIds || []);
  // A task skill's version has no template nor schema: its procedure is what
  // it serves. The gate is the one of the nature of the version published.
  if (version.nature === SkillNatures.TASK) {
    if (!String(version.procedure || '').trim()) {
      throw createError(400, ERROR_CODES.SKILL_PROCEDURE_REQUIRED_TO_PUBLISH);
    }
    return;
  }
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
  openOrStartDraft,
  createVersionAt,
  deleteVersion,
} = versioned;

function versionOf(skill, { major, minor }) {
  const version = findVersion(skill, major, minor);
  if (!version) throw createError(404, `Version ${major}.${minor} not found`);
  return version;
}

/**
 * Publish a draft (versioned-entity.service.js). `payload.openToAll` opens
 * the skill to every company in the same write, and
 * `payload.openExpertiseIds` the expertises of that version chosen to open
 * with it, checked before anything is published. The publication done, a
 * failure to open them is a warning.
 *
 * @returns {Promise<{skill: Object, warnings: Object[]}>} the skill, and the
 *   warnings of its opening
 */
async function activateVersion(skillId, ref, payload = {}, userId) {
  const opened =
    payload.openExpertiseIds === undefined
      ? []
      : await assertOpenable(
          versionOf(await getSkill(skillId), ref),
          payload.openExpertiseIds,
          payload.openToAll === true
        );
  const skill = await versioned.activateVersion(skillId, ref, payload, userId);
  return { skill, warnings: await openExpertises(opened, skillId) };
}

/**
 * What opening the skill to every company would leave out for them, with
 * this version: its consumed expertises kept to the platform company.
 *
 * @returns {Promise<Array<{expertiseId: string, title: string}>>}
 */
async function versionPlatformOnlyExpertises(skillId, ref) {
  return platformOnlyExpertises(versionOf(await getSkill(skillId), ref));
}

// A draft saved with its consumed expertises or its test cases gets them
// checked before anything is written (the shared lifecycle knows nothing of
// them): an incomplete test case would otherwise fail the save as a Mongoose
// ValidationError, answered as a 500.
async function updateVersion(skillId, ref, patch, userId) {
  if (patch && patch.testCases !== undefined) assertTestCases(patch.testCases);
  if (patch && patch.consumedExpertiseIds !== undefined) {
    await assertConsumedExpertises(patch.consumedExpertiseIds);
  }
  return versioned.updateVersion(skillId, ref, patch, userId);
}

/**
 * An assistant's change to a draft it read (versioned-draft.js), its
 * consumed expertises checked before anything is written.
 */
async function writeDraftIfUnchanged(doc, version, patch, userId) {
  if (patch && patch.consumedExpertiseIds !== undefined) {
    await assertConsumedExpertises(patch.consumedExpertiseIds);
  }
  return versioned.writeDraftIfUnchanged(doc, version, patch, userId);
}

const archiveSkill = versioned.archive;

module.exports = {
  VERSION_CONTENT_FIELDS,
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  createMinorVersion,
  createMajorVersion,
  openOrStartDraft,
  writeDraftIfUnchanged,
  createVersionAt,
  updateVersion,
  deleteVersion,
  activateVersion,
  archiveSkill,
  consumedExpertiseWarnings,
  versionPlatformOnlyExpertises,
  versionLabel,
};
