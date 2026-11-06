'use strict';

/**
 * A copy follows production (ADR 0019): production answers everything it
 * holds, and a copy (staging, development) applies it.
 *
 * Production's answer is the skills export (ADR 0018, format 1), extended
 * for a follow: every item, archived ones included, with its state, its
 * audience and its served-to-assistants mark, its active version and its open
 * draft. Still no history and no owner: what a copy lives is what clients
 * live, not who wrote it.
 */

const {
  FORMAT,
  identityOf,
  versionOfKind,
  everyItem,
  byId,
} = require('./skills-export.service.js');
const {
  findActiveVersion,
  openDraftOf,
  versionLabel,
} = require('./version-helpers.js');
const { Audiences } = require('../constant/skill-constants.js');
const {
  Expertises,
  LePatronSkills,
  SkillsFollows,
} = require('../../common/models.common.js');
const { followedItem, signatureOf } = require('./skills-follow-apply.js');
const { readProductionAnswer } = require('./skills-follow-answer.js');

// An item as production answers it to a copy, or null when it holds no
// version at all: there is nothing to follow.
function itemForCopies(kind, doc) {
  const active = findActiveVersion(doc);
  const draft = openDraftOf(doc);
  if (!active && !draft) return null;
  const item = {
    ...identityOf(kind, doc),
    status: String(doc.status).toLowerCase(),
    audience: doc.audience || Audiences.PLATFORM,
  };
  if (kind === 'skill') item.servedToAssistants = !!doc.servedToAssistants;
  if (active) item.version = versionOfKind(kind, active);
  if (draft) item.draft = versionOfKind(kind, draft);
  return item;
}

const itemsForCopies = async (kind, idField) =>
  (await everyItem(kind))
    .map((doc) => itemForCopies(kind, doc))
    .filter(Boolean)
    .sort(byId(idField));

/**
 * Everything production holds, as a copy follows it: the read route's
 * answer to a read token.
 *
 * @param {Object} [context]
 * @param {string} [context.origin] the instance the export comes from
 * @param {string} [context.by] who reads it: the read token's name
 * @returns {Promise<Object>} a skills export, format 1, extended
 */
async function exportForCopies({ origin = '', by = '' } = {}) {
  return {
    format: FORMAT,
    origin,
    exportedAt: new Date().toISOString(),
    exportedBy: by,
    expertises: await itemsForCopies('expertise', 'expertiseId'),
    skills: await itemsForCopies('skill', 'skillId'),
  };
}

const KINDS = [
  { kind: 'expertise', list: 'expertises', idField: 'expertiseId' },
  { kind: 'skill', list: 'skills', idField: 'skillId' },
];
const MODELS = { expertise: () => Expertises, skill: () => LePatronSkills };

// The version an item arrives at, for the report.
const labelOf = (item) => {
  const v = item.version || item.draft;
  return v
    ? versionLabel({ versionMajor: v.major, versionMinor: v.minor })
    : null;
};

// One item of production, applied on the copy; answers where it goes in the
// report.
async function followOne(kind, idField, item, actor, now) {
  const model = MODELS[kind]();
  const doc = await model.findOne({ [idField]: item[idField] }).lean();
  const result = followedItem(kind, item, doc, now);
  if (result.kept) return { bucket: 'kept', reason: result.kept };
  const { fields } = result;
  if (!doc) {
    await model.create({
      [idField]: item[idField],
      ...fields,
      owner: actor.id,
    });
    return { bucket: 'created' };
  }
  if (signatureOf(kind, doc) === signatureOf(kind, { ...doc, ...fields })) {
    return { bucket: 'upToDate' };
  }
  // Through the document, so the model's own rules run on what is written.
  const stored = await model.findOne({ [idField]: item[idField] });
  Object.assign(stored, fields);
  await stored.save();
  return { bucket: 'updated' };
}

// What exists only on the copy stays, and is said to.
async function localOnly(kind, idField, answered) {
  const ids = answered.map((item) => item[idField]);
  const docs = await MODELS[kind]()
    .find({ [idField]: { $nin: ids } }, { [idField]: 1 })
    .lean();
  return docs.map((doc) => ({ kind, id: doc[idField], reason: 'local_only' }));
}

const emptyReport = () => ({
  created: [],
  updated: [],
  upToDate: [],
  kept: [],
  failed: [],
});

async function record(report, { actor, startedAt }) {
  await SkillsFollows.create({
    ...report,
    by: actor.name || '',
    _by: actor.id || null,
    startedAt,
    finishedAt: new Date(),
  });
  return report;
}

/**
 * Follows production (ADR 0019): reads its answer whole, then applies it,
 * expertises first, each item on its own, so one failing stops nothing else.
 * An answer that cannot be fetched or read writes nothing. Each follow is
 * recorded.
 *
 * @param {Object} options
 * @param {() => Promise<Object>} options.fetchExport production's answer
 * @param {{ id?: string, name?: string }} options.actor who follows
 * @returns {Promise<Object>} the report: `status` (`succeeded`, `partial`,
 *   `failed`), `origin`, and the lists `created`, `updated`, `upToDate`,
 *   `kept` (with a `reason`) and `failed` (with a `message`), each of
 *   `{ kind, id, version }`
 */
async function followProduction({ fetchExport, actor }) {
  const startedAt = new Date();
  let answer;
  try {
    answer = readProductionAnswer(await fetchExport());
  } catch (err) {
    return record(
      {
        ...emptyReport(),
        status: 'failed',
        // A word the page translates; anything unforeseen reads "unreachable".
        reason: err.reason || 'unreachable',
        message: err.message,
      },
      { actor, startedAt }
    );
  }

  const report = { ...emptyReport(), origin: answer.origin };
  for (const { kind, list, idField } of KINDS) {
    for (const item of answer[list]) {
      const entry = { kind, id: item[idField], version: labelOf(item) };
      try {
        // eslint-disable-next-line no-await-in-loop
        const { bucket, reason } = await followOne(
          kind,
          idField,
          item,
          actor,
          startedAt
        );
        report[bucket].push(reason ? { ...entry, reason } : entry);
      } catch (err) {
        report.failed.push({ ...entry, message: err.message });
      }
    }
    // eslint-disable-next-line no-await-in-loop
    report.kept.push(...(await localOnly(kind, idField, answer[list])));
  }
  report.status = report.failed.length ? 'partial' : 'succeeded';
  return record(report, { actor, startedAt });
}

/**
 * The last follow, as the copy's page shows it: how it ended, when, by whom,
 * how many items each outcome holds, and the items that failed.
 *
 * @returns {Promise<Object|null>}
 */
async function lastFollow() {
  const last = await SkillsFollows.findOne({}).sort({ startedAt: -1 }).lean();
  if (!last) return null;
  const count = (list) => (list || []).length;
  return {
    status: last.status,
    reason: last.reason || null,
    message: last.message || null,
    origin: last.origin || '',
    by: last.by,
    at: last.finishedAt,
    created: count(last.created),
    updated: count(last.updated),
    upToDate: count(last.upToDate),
    kept: count(last.kept),
    failed: count(last.failed),
    failures: (last.failed || []).map(({ kind, id, message }) => ({
      kind,
      id,
      message,
    })),
  };
}

module.exports = { exportForCopies, followProduction, lastFollow };
