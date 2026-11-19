'use strict';

/**
 * The skills export (ADR 0018): the active version of chosen skills and
 * expertises, as a file another LePatron instance imports as drafts.
 *
 * The file carries what a skill or an expertise is, never what belongs to the
 * instance holding it: no audience, no serving to assistants, no owner, no
 * history. Only active versions travel; an archived item or one never
 * published is not exported.
 */

const createError = require('http-errors');
const ERROR_CODES = require('../../constant/error-codes.js');
const { Expertises, LePatronSkills } = require('../../common/models.common.js');
const {
  SkillStatuses,
  SkillNatures,
} = require('../constant/skill-constants.js');
const { findActiveVersion } = require('./version-helpers.js');
const skillService = require('./skill.service.js');
const expertiseService = require('./expertise.service.js');
const { FORMAT, readSkillsExport } = require('./skills-export.format.js');

const ENTITIES = {
  expertise: {
    model: () => Expertises,
    idField: 'expertiseId',
    contentFields: expertiseService.VERSION_CONTENT_FIELDS,
    fields: [
      'title',
      'description',
      'category',
      'scope',
      'isTransversal',
      'appliesToEmailTypes',
      'appliesToLanguages',
    ],
  },
  skill: {
    model: () => LePatronSkills,
    idField: 'skillId',
    contentFields: skillService.VERSION_CONTENT_FIELDS,
    // The nature is the version's (ADR 0013), carried with its content.
    fields: ['title', 'description', 'category'],
  },
};

const copy = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// A field stored as null is a field not set, which a file leaves out: the
// format reads null nowhere. In an embedded object (the model hints) or each
// one of a list (the test cases), not inside a test case's own values.
function withoutNulls(value) {
  const strip = (object) =>
    Object.fromEntries(Object.entries(object).filter(([, v]) => v !== null));
  if (Array.isArray(value)) {
    return value.map((element) =>
      isPlainObject(element) ? strip(element) : element
    );
  }
  return isPlainObject(value) ? strip(value) : value;
}

// What a version says, without the notes that come with its release: every
// content field, at its empty value when missing, so a file reads the same
// whatever the age of the version it comes from, and a field a file leaves
// out compares as this instance stores it.
function contentOf(version, contentFields) {
  const out = {};
  contentFields.forEach(({ name, default: empty }) => {
    const value = version[name];
    out[name] =
      value === undefined || value === null
        ? empty()
        : withoutNulls(copy(value));
  });
  return out;
}

function versionOf(version, contentFields) {
  return {
    major: version.versionMajor,
    minor: version.versionMinor,
    ...contentOf(version, contentFields),
    changelog: version.changelog || '',
    releaseNotes: version.releaseNotes || '',
  };
}

// What a skill or an expertise is, without any of its versions.
function identityOf(kind, doc) {
  const { idField, fields } = ENTITIES[kind];
  const item = { [idField]: doc[idField] };
  fields.forEach((field) => {
    if (doc[field] !== undefined && doc[field] !== null) {
      item[field] = copy(doc[field]);
    }
  });
  return item;
}

// A version as a file carries it, for an item of this kind.
const versionOfKind = (kind, version) =>
  versionOf(version, ENTITIES[kind].contentFields);

function itemOf(kind, doc) {
  return {
    ...identityOf(kind, doc),
    version: versionOfKind(kind, findActiveVersion(doc)),
  };
}

// Why an item cannot be exported, as an ERROR_CODES entry, or null.
function refusalOf(doc) {
  if (doc.status === SkillStatuses.ARCHIVED) {
    return ERROR_CODES.SKILLS_EXPORT_ARCHIVED;
  }
  if (!findActiveVersion(doc)) return ERROR_CODES.SKILLS_EXPORT_NOT_PUBLISHED;
  return null;
}

// What an export reads of an item: its fields and its active version, not
// the history.
function exportedFields(kind) {
  const { idField, fields } = ENTITIES[kind];
  const projection = { [idField]: 1, status: 1, activeVersion: 1 };
  fields.forEach((field) => {
    projection[field] = 1;
  });
  projection.versions = { $elemMatch: { status: SkillStatuses.ACTIVE } };
  return projection;
}

async function exportable(kind, chosen, { strict }) {
  const { model, idField } = ENTITIES[kind];
  const ids = [...new Set(chosen)];
  const docs = await model()
    .find({ [idField]: { $in: ids } }, exportedFields(kind))
    .lean();
  return ids
    .map((id) => {
      const doc = docs.find((candidate) => candidate[idField] === id);
      const refusal = doc
        ? refusalOf(doc)
        : ERROR_CODES.SKILLS_EXPORT_NOT_FOUND;
      if (refusal && strict) throw createError(400, refusal, { id });
      return refusal ? null : doc;
    })
    .filter(Boolean);
}

async function everyExportable(kind) {
  const docs = await ENTITIES[kind]
    .model()
    .find({ status: { $ne: SkillStatuses.ARCHIVED } }, exportedFields(kind))
    .lean();
  return docs.filter((doc) => !refusalOf(doc));
}

const byId = (idField) => (a, b) => a[idField].localeCompare(b[idField]);

// Every skill or expertise of the instance, archived ones included.
const everyItem = (kind) => ENTITIES[kind].model().find({}).lean();

/**
 * The skills export of a selection, or of every active item.
 *
 * Selecting a task skill brings the expertises it consumes, but those left in
 * `withoutExpertiseIds`; one that cannot be exported is left for the import
 * to warn about. A selected item that cannot be exported is refused.
 *
 * @param {Object} selection
 * @param {string[]} [selection.skillIds]
 * @param {string[]} [selection.expertiseIds]
 * @param {string[]} [selection.withoutExpertiseIds]
 * @param {boolean} [selection.all]
 * @param {Object} context
 * @param {{ name?: string, email?: string }} context.user who exports
 * @param {string} context.origin the instance the file comes from
 */
async function exportSkills(
  { skillIds = [], expertiseIds = [], withoutExpertiseIds = [], all = false },
  { user, origin }
) {
  let skills;
  let expertises;
  if (all) {
    skills = await everyExportable('skill');
    expertises = await everyExportable('expertise');
  } else {
    skills = await exportable('skill', skillIds, { strict: true });
    expertises = await exportable('expertise', expertiseIds, { strict: true });
    // Only a task skill's version consumes expertises.
    const consumed = skills
      .map(findActiveVersion)
      .filter((version) => version.nature === SkillNatures.TASK)
      .flatMap((version) => version.consumedExpertiseIds || [])
      .filter(
        (id) =>
          !withoutExpertiseIds.includes(id) &&
          !expertises.some((doc) => doc.expertiseId === id)
      );
    const added = await exportable('expertise', [...new Set(consumed)], {
      strict: false,
    });
    expertises = [...expertises, ...added];
  }

  return {
    format: FORMAT,
    origin,
    exportedAt: new Date().toISOString(),
    // A name is not required on an account; an email is.
    exportedBy: user.name || user.email || '',
    expertises: expertises
      .map((doc) => itemOf('expertise', doc))
      .sort(byId('expertiseId')),
    skills: skills.map((doc) => itemOf('skill', doc)).sort(byId('skillId')),
  };
}

module.exports = {
  exportSkills,
  // What the import reads a file's items with (skills-import.service.js).
  ENTITIES,
  contentOf,
  identityOf,
  versionOfKind,
  everyItem,
  byId,
  readSkillsExport,
  FORMAT,
};
