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
const { z } = require('zod');
const { Expertises, LePatronSkills } = require('../../common/models.common.js');
const {
  SkillStatuses,
  SkillNatures,
  SkillIdRegex,
} = require('../constant/skill-constants.js');
const { findActiveVersion } = require('./version-helpers.js');
const skillService = require('./skill.service.js');
const expertiseService = require('./expertise.service.js');

const FORMAT = 1;

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

// Every content field of the version, at its empty value when missing, so a
// file reads the same whatever the age of the version it comes from.
function versionOf(version, contentFields) {
  const out = { major: version.versionMajor, minor: version.versionMinor };
  contentFields.forEach(({ name, default: empty }) => {
    const value = version[name];
    out[name] = value === undefined || value === null ? empty() : copy(value);
  });
  out.changelog = version.changelog || '';
  out.releaseNotes = version.releaseNotes || '';
  return out;
}

function itemOf(kind, doc) {
  const { idField, fields, contentFields } = ENTITIES[kind];
  const item = { [idField]: doc[idField] };
  fields.forEach((field) => {
    if (doc[field] !== undefined) item[field] = copy(doc[field]);
  });
  item.version = versionOf(findActiveVersion(doc), contentFields);
  return item;
}

// Why an item cannot be exported, or null when it can.
function refusalOf(doc) {
  if (doc.status === SkillStatuses.ARCHIVED) return 'is archived';
  if (!findActiveVersion(doc)) return 'has no active version';
  return null;
}

async function exportable(kind, ids, { strict }) {
  const { model, idField } = ENTITIES[kind];
  const docs = await model()
    .find({ [idField]: { $in: ids } })
    .lean();
  return ids
    .map((id) => {
      const doc = docs.find((candidate) => candidate[idField] === id);
      const refusal = doc ? refusalOf(doc) : 'does not exist';
      if (refusal && strict) throw createError(400, `"${id}" ${refusal}.`);
      return refusal ? null : doc;
    })
    .filter(Boolean);
}

async function everyExportable(kind) {
  const docs = await ENTITIES[kind]
    .model()
    .find({ status: { $ne: SkillStatuses.ARCHIVED } })
    .lean();
  return docs.filter((doc) => !refusalOf(doc));
}

const byId = (idField) => (a, b) => a[idField].localeCompare(b[idField]);

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
 * @param {{ name: string }} context.user who exports
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
    exportedBy: user.name,
    expertises: expertises
      .map((doc) => itemOf('expertise', doc))
      .sort(byId('expertiseId')),
    skills: skills.map((doc) => itemOf('skill', doc)).sort(byId('skillId')),
  };
}

const VERSION = z
  .object({
    major: z.number().int().min(1),
    minor: z.number().int().min(0),
  })
  .passthrough();
const itemSchema = (idField) =>
  z
    .object({
      [idField]: z.string().regex(SkillIdRegex),
      title: z.string().min(1),
      category: z.string().min(1),
      version: VERSION,
    })
    .passthrough();
const FILE = z
  .object({
    format: z.literal(FORMAT),
    origin: z.string(),
    exportedAt: z.string(),
    exportedBy: z.string(),
    expertises: z.array(itemSchema('expertiseId')),
    skills: z.array(itemSchema('skillId')),
  })
  .passthrough();

/**
 * A skills export read from its JSON, or a 400 saying why it cannot be: an
 * unknown format, or a content that fails validation. The whole file is
 * refused, before anything is shown.
 */
function readSkillsExport(json) {
  if (!json || json.format !== FORMAT) {
    throw createError(
      400,
      `Unknown skills export format: ${
        json && json.format
      }. This instance reads format ${FORMAT}.`
    );
  }
  const parsed = FILE.safeParse(json);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    throw createError(
      400,
      `Invalid skills export: ${issue.path.join('.')} ${issue.message}`
    );
  }
  return parsed.data;
}

module.exports = { exportSkills, readSkillsExport, FORMAT };
