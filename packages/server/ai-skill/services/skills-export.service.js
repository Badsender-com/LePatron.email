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

const { isDeepStrictEqual } = require('util');
const createError = require('http-errors');
const ERROR_CODES = require('../../constant/error-codes.js');
const { Expertises, LePatronSkills } = require('../../common/models.common.js');
const {
  SkillStatuses,
  SkillNatures,
  Audiences,
} = require('../constant/skill-constants.js');
const {
  findActiveVersion,
  findVersion,
  openDraftOf,
  versionLabel,
} = require('./version-helpers.js');
const { hasSchema } = require('../schemas');
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

// Whatever order the keys of an embedded object come in.
const sameContent = (a, b, contentFields) =>
  isDeepStrictEqual(contentOf(a, contentFields), contentOf(b, contentFields));

function itemOf(kind, doc) {
  const { idField, fields, contentFields } = ENTITIES[kind];
  const item = { [idField]: doc[idField] };
  fields.forEach((field) => {
    if (doc[field] !== undefined && doc[field] !== null) {
      item[field] = copy(doc[field]);
    }
  });
  item.version = versionOf(findActiveVersion(doc), contentFields);
  return item;
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

const KINDS = ['expertise', 'skill'];
const listOf = (kind) => (kind === 'skill' ? 'skills' : 'expertises');
const labelOf = ({ major, minor }) =>
  versionLabel({ versionMajor: major, versionMinor: minor });

// -1, 0 or 1 as the file's version stands to a version of this instance.
function compare({ major, minor }, version) {
  if (major !== version.versionMajor) {
    return major > version.versionMajor ? 1 : -1;
  }
  if (minor === version.versionMinor) return 0;
  return minor > version.versionMinor ? 1 : -1;
}

// A version stored before natures were versioned has none: a feature one.
const natureOf = (version) => version.nature || SkillNatures.FEATURE;

// A schema a skill's version names, when this instance's code lacks it: the
// model refuses an unknown schema id, whatever the skill's nature.
function lacksSchema(kind, item) {
  if (kind !== 'skill') return false;
  const { inputSchemaId, outputSchemaId } = item.version;
  return [inputSchemaId, outputSchemaId].some((id) => id && !hasSchema(id));
}

// What an import would do with one item of the file, against this instance.
function stateOf(kind, item, doc) {
  if (doc && doc.status === SkillStatuses.ARCHIVED) {
    return { state: 'blocked', reason: 'archived' };
  }
  const active = doc && findActiveVersion(doc);
  if (active) {
    const order = compare(item.version, active);
    if (order < 0) return { state: 'blocked', reason: 'target_newer' };
    if (order === 0) {
      const { contentFields } = ENTITIES[kind];
      return sameContent(active, item.version, contentFields)
        ? { state: 'up_to_date' }
        : { state: 'blocked', reason: 'diverged' };
    }
  }
  // Before the version's number: the same file imported again finds the
  // draft its first import opened.
  if (doc && openDraftOf(doc)) {
    return { state: 'blocked', reason: 'draft_open' };
  }
  // Archived here, or left behind when an older draft was published.
  if (doc && findVersion(doc, item.version.major, item.version.minor)) {
    return { state: 'blocked', reason: 'version_exists' };
  }
  if (lacksSchema(kind, item)) {
    return { state: 'blocked', reason: 'missing_schema' };
  }
  return { state: doc ? 'update' : 'new' };
}

// The expertises an item's version consumes: none for an expertise.
const consumedOf = (item) => item.version.consumedExpertiseIds || [];

async function docsOf(kind, ids) {
  const { model, idField } = ENTITIES[kind];
  const docs = await model()
    .find({ [idField]: { $in: ids } })
    .lean();
  return new Map(docs.map((doc) => [doc[idField], doc]));
}

// The preview of a file already read.
async function previewOf(file) {
  const docs = {};
  for (const kind of KINDS) {
    const { idField } = ENTITIES[kind];
    // eslint-disable-next-line no-await-in-loop
    docs[kind] = await docsOf(
      kind,
      file[listOf(kind)].map((item) => item[idField])
    );
  }
  const inFile = new Set(file.expertises.map((item) => item.expertiseId));
  const consumed = file.skills.flatMap(consumedOf);
  const known = await docsOf('expertise', consumed);

  const items = KINDS.flatMap((kind) => {
    const { idField } = ENTITIES[kind];
    return file[listOf(kind)].map((item) => {
      const id = item[idField];
      const doc = docs[kind].get(id);
      const active = doc && findActiveVersion(doc);
      const preview = {
        kind,
        id,
        title: item.title,
        version: labelOf(item.version),
        current: active ? versionLabel(active) : null,
        ...stateOf(kind, item, doc),
      };
      const missing = consumedOf(item).filter(
        (expertiseId) => !inFile.has(expertiseId) && !known.has(expertiseId)
      );
      const warnings = [];
      if (missing.length) {
        warnings.push({ code: 'missing_expertises', expertiseIds: missing });
      }
      // The nature is the version's (ADR 0013): a version of another nature
      // arrives as a draft with its own, and publishing it is how the skill
      // changes nature.
      if (
        preview.state === 'update' &&
        kind === 'skill' &&
        active &&
        natureOf(active) !== natureOf(item.version)
      ) {
        warnings.push({
          code: 'nature_differs',
          nature: natureOf(item.version),
          current: natureOf(active),
        });
      }
      if (warnings.length) preview.warnings = warnings;
      return preview;
    });
  });

  const { origin, exportedAt, exportedBy } = file;
  return { origin, exportedAt, exportedBy, items };
}

/**
 * What importing a skills export would do here, item by item, writing
 * nothing (ADR 0018): `new`, `update`, `up_to_date`, or `blocked` with its
 * reason. A task skill whose consumed expertise is neither in the file nor
 * here carries a warning, and stays importable; so does a skill whose version
 * has another nature than its active one here.
 *
 * @param {Object} json the file, read again here
 * @returns {Promise<{ origin, exportedAt, exportedBy, items: Object[] }>}
 */
async function previewImport(json) {
  return previewOf(readSkillsExport(json));
}

const SERVICES = { expertise: expertiseService, skill: skillService };

// A new item: the document, as the back office creates one, with the
// imported version in place of the blank 1.0 draft a creation seeds, in one
// write: the model validates the document with its version, so a refused
// version leaves nothing behind. Nothing opened to the outside, owned by the
// person importing.
function create(kind, item, userId) {
  const { version, ...data } = item;
  const { major, minor, ...content } = version;
  const options = {
    initialVersion: { versionMajor: major, versionMinor: minor, ...content },
  };
  const owned = { ...data, audience: Audiences.PLATFORM };
  return kind === 'skill'
    ? skillService.createSkill(owned, userId, {}, options)
    : expertiseService.createExpertise(owned, userId, {}, options);
}

/**
 * Imports the chosen items of a skills export as drafts (ADR 0018):
 * expertises first, then skills, each on its own, so one failing item stops
 * nothing else. A chosen item the preview does not let through is skipped,
 * with its reason. Each imported version keeps the source's number; the
 * active version here keeps serving until a person publishes the draft.
 *
 * @param {Object} json the file
 * @param {{ expertiseIds?: string[], skillIds?: string[] }} chosen
 * @param {{ user: { id: string } }} context
 * @returns {Promise<{ created, updated, skipped, failed }>} each a list of
 *   `{ kind, id, version }`, with a `reason` when skipped and a `message`
 *   when failed, and, as the preview has them, the `warnings` of a skill
 *   whose consumed expertises are still missing here once the import is
 *   done, or whose nature differs from its active version here; a chosen id the file
 *   does not hold is skipped as
 *   `not_in_file`, without a version
 */
async function importSkills(
  json,
  { expertiseIds = [], skillIds = [] },
  { user }
) {
  const file = readSkillsExport(json);
  const { items } = await previewOf(file);
  const chosen = { expertise: expertiseIds, skill: skillIds };
  const report = { created: [], updated: [], skipped: [], failed: [] };
  // The expertises the skills consume that are here before the import; those
  // it creates join them as it goes.
  const available = new Set(
    (await docsOf('expertise', file.skills.flatMap(consumedOf))).keys()
  );

  for (const kind of KINDS) {
    const { idField } = ENTITIES[kind];
    // A choice the file does not hold, as from a screen reading another file.
    const inFile = new Set(file[listOf(kind)].map((item) => item[idField]));
    [...new Set(chosen[kind])]
      .filter((id) => !inFile.has(id))
      .forEach((id) =>
        report.skipped.push({ kind, id, reason: 'not_in_file' })
      );
    const wanted = file[listOf(kind)].filter((item) =>
      chosen[kind].includes(item[idField])
    );
    for (const item of wanted) {
      const id = item[idField];
      const entry = { kind, id, version: labelOf(item.version) };
      const preview = items.find((p) => p.kind === kind && p.id === id);
      if (preview.state !== 'new' && preview.state !== 'update') {
        report.skipped.push({
          ...entry,
          reason: preview.reason || preview.state,
        });
        continue; // eslint-disable-line no-continue
      }
      // Not chosen, blocked or failed, an expertise of the file is as
      // missing as one it does not hold: the draft cannot be published until
      // it is here (ADR 0018).
      const missing = consumedOf(item).filter((e) => !available.has(e));
      const warnings = [
        ...(missing.length
          ? [{ code: 'missing_expertises', expertiseIds: missing }]
          : []),
        // The preview's, which the import does not change.
        ...(preview.warnings || []).filter(
          ({ code }) => code !== 'missing_expertises'
        ),
      ];
      const done = warnings.length ? { ...entry, warnings } : entry;
      try {
        if (preview.state === 'new') {
          // eslint-disable-next-line no-await-in-loop
          await create(kind, item, user.id);
          report.created.push(done);
          if (kind === 'expertise') available.add(id);
        } else {
          // eslint-disable-next-line no-await-in-loop
          await SERVICES[kind].createVersionAt(
            id,
            item.version,
            item.version,
            user.id
          );
          report.updated.push(done);
        }
      } catch (err) {
        report.failed.push({ ...entry, message: err.message });
      }
    }
  }
  return report;
}

module.exports = {
  exportSkills,
  readSkillsExport,
  previewImport,
  importSkills,
  FORMAT,
};
