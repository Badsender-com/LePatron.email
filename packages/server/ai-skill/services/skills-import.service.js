'use strict';

/**
 * The import of a skills export (ADR 0018): what a file would do here, item
 * by item, and the chosen items written as drafts. The file is the one
 * skills-export.service.js writes, read by skills-export.format.js.
 */

const { isDeepStrictEqual } = require('util');
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
const { readSkillsExport } = require('./skills-export.format.js');
const { ENTITIES, contentOf } = require('./skills-export.service.js');

// Whatever order the keys of an embedded object come in.
const sameContent = (a, b, contentFields) =>
  isDeepStrictEqual(contentOf(a, contentFields), contentOf(b, contentFields));

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
      // Not chosen or failed, an expertise of the file is as missing as one
      // it does not hold: the draft cannot be published until it is here
      // (ADR 0018). One blocked is here already.
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

module.exports = { previewImport, importSkills };
