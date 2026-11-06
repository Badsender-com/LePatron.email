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
  SkillNatureValues,
  SkillCategoryValues,
  SkillIdRegex,
  Audiences,
  MaxConsumedExpertises,
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

// What a skill or an expertise is, without any of its versions.
function identityOf(kind, doc) {
  const { idField, fields } = ENTITIES[kind];
  const item = { [idField]: doc[idField] };
  fields.forEach((field) => {
    if (doc[field] !== undefined) item[field] = copy(doc[field]);
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

// Why an item cannot be exported, or null when it can.
function refusalOf(doc) {
  if (doc.status === SkillStatuses.ARCHIVED) return 'is archived';
  if (!findActiveVersion(doc)) return 'has no active version';
  return null;
}

async function exportable(kind, chosen, { strict }) {
  const { model, idField } = ENTITIES[kind];
  const ids = [...new Set(chosen)];
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

// What a file may hold, typed, so a wrong file is refused whole before the
// preview rather than failing item by item at the import (ADR 0018). Keys
// this format does not know are dropped.
const id = z.string().regex(SkillIdRegex);
const strings = z.array(z.string());
const version = (content) =>
  z.object({
    major: z.number().int().min(1),
    minor: z.number().int().min(0),
    changelog: z.string().optional(),
    releaseNotes: z.string().optional(),
    ...content,
  });
const TEST_CASE = z.object({
  name: z.string().min(1),
  input: z
    .unknown()
    .refine((value) => value !== undefined && value !== null, 'Required'),
  expectedOutput: z.unknown().optional(),
  notes: z.string().optional(),
});
const EXPERTISE = z.object({
  expertiseId: id,
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(SkillCategoryValues),
  scope: strings.optional(),
  isTransversal: z.boolean().optional(),
  appliesToEmailTypes: strings.optional(),
  appliesToLanguages: strings.optional(),
  version: version({
    body: z.string().optional(),
    examplesGood: strings.optional(),
    examplesBad: strings.optional(),
  }),
});
const SKILL = z.object({
  skillId: id,
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(SkillCategoryValues),
  version: version({
    // The version's, as every content of it (ADR 0013).
    nature: z.enum(SkillNatureValues),
    systemPrompt: z.string().optional(),
    skillBody: z.string().optional(),
    inputTemplate: z.string().optional(),
    inputSchemaId: z.string().optional(),
    outputSchemaId: z.string().optional(),
    modelHints: z
      .object({
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
        topP: z.number().optional(),
      })
      .optional(),
    testCases: z.array(TEST_CASE).optional(),
    procedure: z.string().optional(),
    // As the back office saves them: each named once, a bounded list.
    consumedExpertiseIds: z
      .array(id)
      .max(MaxConsumedExpertises)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'names an expertise twice'
      )
      .optional(),
  }),
});
// An item twice would be previewed twice, and its second import would fail.
const once = (idField) => (items, ctx) => {
  const seen = new Set();
  items.forEach((item, index) => {
    if (seen.has(item[idField])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, idField],
        message: `"${item[idField]}" is in the file twice`,
      });
    }
    seen.add(item[idField]);
  });
};
const FILE = z
  .object({
    format: z.literal(FORMAT),
    origin: z.string(),
    exportedAt: z.string(),
    exportedBy: z.string(),
    expertises: z.array(EXPERTISE).superRefine(once('expertiseId')),
    skills: z.array(SKILL).superRefine(once('skillId')),
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

// What a version says, without the notes that come with its release.
const contentOf = (version, contentFields) =>
  JSON.stringify(
    contentFields.map(({ name }) => [name, version[name] ?? null])
  );

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
      const same =
        contentOf(versionOf(active, contentFields), contentFields) ===
        contentOf(item.version, contentFields);
      return same
        ? { state: 'up_to_date' }
        : { state: 'blocked', reason: 'diverged' };
    }
  }
  // Archived here, or left behind when an older draft was published.
  if (doc && findVersion(doc, item.version.major, item.version.minor)) {
    return { state: 'blocked', reason: 'version_exists' };
  }
  if (doc && openDraftOf(doc)) {
    return { state: 'blocked', reason: 'draft_open' };
  }
  // An import brings a version, not a change of nature: the nature of the
  // active version here is kept.
  if (
    kind === 'skill' &&
    active &&
    natureOf(active) !== natureOf(item.version)
  ) {
    return { state: 'blocked', reason: 'nature_differs' };
  }
  if (lacksSchema(kind, item)) {
    return { state: 'blocked', reason: 'missing_schema' };
  }
  return { state: doc ? 'update' : 'new' };
}

async function docsOf(kind, ids) {
  const { model, idField } = ENTITIES[kind];
  const docs = await model()
    .find({ [idField]: { $in: ids } })
    .lean();
  return new Map(docs.map((doc) => [doc[idField], doc]));
}

/**
 * What importing a skills export would do here, item by item, writing
 * nothing (ADR 0018): `new`, `update`, `up_to_date`, or `blocked` with its
 * reason. A task skill whose consumed expertise is neither in the file nor
 * here carries a warning, and stays importable.
 *
 * @param {Object} json the file, read again here
 * @returns {Promise<{ origin, exportedAt, exportedBy, items: Object[] }>}
 */
async function previewImport(json) {
  const file = readSkillsExport(json);
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
  const consumed = file.skills.flatMap(
    (item) => item.version.consumedExpertiseIds || []
  );
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
      const missing = (item.version.consumedExpertiseIds || []).filter(
        (expertiseId) => !inFile.has(expertiseId) && !known.has(expertiseId)
      );
      if (missing.length) {
        preview.warnings = [
          { code: 'missing_expertises', expertiseIds: missing },
        ];
      }
      return preview;
    });
  });

  const { origin, exportedAt, exportedBy } = file;
  return { origin, exportedAt, exportedBy, items };
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
    ? skillService.createSkill(owned, userId, options)
    : expertiseService.createExpertise(owned, userId, options);
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
 *   when failed
 */
async function importSkills(
  json,
  { expertiseIds = [], skillIds = [] },
  { user }
) {
  const file = readSkillsExport(json);
  const { items } = await previewImport(file);
  const chosen = { expertise: expertiseIds, skill: skillIds };
  const report = { created: [], updated: [], skipped: [], failed: [] };

  for (const kind of KINDS) {
    const { idField } = ENTITIES[kind];
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
      try {
        if (preview.state === 'new') {
          // eslint-disable-next-line no-await-in-loop
          await create(kind, item, user.id);
          report.created.push(entry);
        } else {
          // eslint-disable-next-line no-await-in-loop
          await SERVICES[kind].createVersionAt(
            id,
            item.version,
            item.version,
            user.id
          );
          report.updated.push(entry);
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
  identityOf,
  versionOfKind,
  everyItem,
  byId,
  readSkillsExport,
  previewImport,
  importSkills,
  FORMAT,
  // What a file holds of one item, for production's answer to a copy.
  ITEM_SCHEMAS: { expertise: EXPERTISE, skill: SKILL },
};
