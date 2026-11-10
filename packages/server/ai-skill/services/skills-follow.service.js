'use strict';

/**
 * A copy follows production (ADR 0019): it reads production's answer
 * (skills-follow.format.js), works out what each item becomes
 * (skills-follow-apply.js), and writes it here, item by item.
 *
 * Each write is conditioned on the item as it was read: an item written
 * meanwhile, from the back office or by an assistant, fails the follow of
 * that item rather than be written over. The copy's own work leaves for a
 * new item before the item it leaves is written.
 */

const createError = require('http-errors');
const logger = require('../../utils/logger.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const { SkillNatures } = require('../constant/skill-constants.js');
const { versionLabel } = require('./version-helpers.js');
const { plain } = require('./versioned-draft.js');
const { ENTITIES } = require('./skills-export.service.js');
const { Expertises } = require('../../common/models.common.js');
const { KINDS, readProductionAnswer } = require('./skills-follow.format.js');
const { followedItem, withdrawnItem } = require('./skills-follow-apply.js');
const { createCopyItem } = require('./skills-copy.service.js');
const { takeLock, record } = require('./skills-follow-lock.js');

const modelOf = (kind) => ENTITIES[kind].model();

// The version an item arrives at, for the report.
const labelOf = (item) => {
  const v = item.version || item.draft;
  return v
    ? versionLabel({ versionMajor: v.major, versionMinor: v.minor })
    : null;
};

const changed = (id) =>
  createError(409, ERROR_CODES.SKILLS_FOLLOW_ITEM_CHANGED, { id });

// The item as it was read: what a write is conditioned on.
const asRead = (idField, read) => ({
  [idField]: read[idField],
  updatedAt: read.updatedAt || null,
  versions: { $size: (read.versions || []).length },
});

// Writes the followed fields over the item read, through the model's own
// rules (an expertise derives its sections), on the condition that it was
// not written since. The fields production no longer has are unset.
async function writeIfUnchanged(kind, doc, read, { fields, unset }) {
  const { idField } = ENTITIES[kind];
  Object.assign(doc, fields);
  unset.forEach((field) => {
    // eslint-disable-next-line no-param-reassign
    doc[field] = undefined;
  });
  await doc.validate();
  const update = { $set: { ...fields, versions: doc.versions.map(plain) } };
  if (unset.length) {
    update.$unset = Object.fromEntries(unset.map((field) => [field, '']));
  }
  const written = await modelOf(kind).findOneAndUpdate(
    asRead(idField, read),
    update,
    { new: true }
  );
  if (!written) throw changed(read[idField]);
}

/**
 * One item production answered, followed on the copy.
 *
 * @returns {Promise<Object>} what followedItem says, with the `copyId` of
 *   the item the copy's own work went to
 */
async function followOne(kind, item, { actor, now }) {
  const model = modelOf(kind);
  const { idField } = ENTITIES[kind];
  const doc = await model.findOne({ [idField]: item[idField] });
  const read = doc && doc.toObject({ virtuals: false });
  const result = followedItem(kind, item, read, now);
  if (!result.fields) return result;
  if (!doc) {
    try {
      await model.create({
        [idField]: item[idField],
        ...result.fields,
        owner: actor.id,
      });
    } catch (err) {
      if (err && err.code === 11000) throw changed(item[idField]);
      throw err;
    }
    return result;
  }
  const copyId = result.moved.length
    ? await createCopyItem(kind, read, result.moved, { now, owner: actor.id })
    : null;
  try {
    await writeIfUnchanged(kind, doc, read, result);
  } catch (err) {
    // The item stays as it was: so does the copy's work, which stays in it.
    if (copyId) await model.deleteOne({ [idField]: copyId });
    throw err;
  }
  return { ...result, copyId };
}

// An item production no longer answers: kept, or removed once the copy's
// own work on it is moved out.
async function withdrawOne(kind, read, { actor, now }) {
  const { idField } = ENTITIES[kind];
  const result = withdrawnItem(read);
  if (result.outcome !== 'removed') return result;
  const copyId = result.moved.length
    ? await createCopyItem(kind, read, result.moved, { now, owner: actor.id })
    : null;
  const { deletedCount } = await modelOf(kind).deleteOne(asRead(idField, read));
  if (!deletedCount) {
    if (copyId) await modelOf(kind).deleteOne({ [idField]: copyId });
    throw changed(read[idField]);
  }
  return { ...result, copyId };
}

// Why an item failed, as a code the page translates; the message stays in
// the logs.
function codeOf(err) {
  if (err && Object.values(ERROR_CODES).includes(err.message)) {
    return err.message;
  }
  if (err && (err.status === 400 || err.name === 'ValidationError')) {
    return ERROR_CODES.SKILLS_FOLLOW_ITEM_INVALID;
  }
  return ERROR_CODES.SKILLS_FOLLOW_ITEM_FAILED;
}

const emptyReport = () => ({
  created: [],
  updated: [],
  upToDate: [],
  kept: [],
  moved: [],
  removed: [],
  failed: [],
});

// What one item did, into the report. An item's warnings are said once,
// with its outcome; a removal says whether it is a draft (`scope: 'draft'`,
// with its `version`) or the whole item (`scope: 'item'`).
function report(into, entry, result) {
  const { outcome, reason, productionChanged, copyId } = result;
  if (outcome === 'kept') {
    into.kept.push({
      ...entry,
      reason,
      ...(productionChanged === undefined ? {} : { productionChanged }),
    });
    return;
  }
  const { warnings: _said, ...item } = entry;
  if (outcome === 'removed') {
    into.removed.push({ ...item, scope: 'item' });
  } else {
    into[outcome].push(entry);
  }
  if (copyId) into.moved.push({ ...item, copyId });
  (result.removed || []).forEach((version) =>
    into.removed.push({ ...item, version, scope: 'draft' })
  );
}

// The expertises a skill's versions consume that the copy does not hold.
function missingExpertises(item, present) {
  const consumed = [item.version, item.draft]
    .filter((v) => v && v.nature === SkillNatures.TASK)
    .flatMap((v) => v.consumedExpertiseIds || []);
  return [...new Set(consumed)].filter((id) => !present.has(id));
}

async function applyKind({ kind, list, idField }, answer, into, context) {
  const present =
    kind === 'skill'
      ? new Set(
          (await Expertises.find({}, { expertiseId: 1 }).lean()).map(
            (doc) => doc.expertiseId
          )
        )
      : null;
  for (const item of answer[list]) {
    const entry = { kind, id: item[idField], version: labelOf(item) };
    if (present) {
      const missing = missingExpertises(item, present);
      if (missing.length) {
        entry.warnings = [
          { code: 'missing_expertises', expertiseIds: missing },
        ];
      }
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      report(into, entry, await followOne(kind, item, context));
    } catch (err) {
      logger.warn(`[skills-follow] ${kind} ${entry.id}: ${err.message}`);
      into.failed.push({ ...entry, code: codeOf(err) });
    }
  }
  // An item production answered that this copy could not read is not
  // withdrawn: it failed. When its id cannot be read either, nothing is.
  const rejected = answer.rejected.filter((r) => r.kind === kind);
  if (rejected.some(({ id }) => !id)) return;
  // Nor is an item this follow just made of the copy's work.
  const answered = [
    ...answer[list].map((item) => item[idField]),
    ...rejected.map(({ id }) => id),
    ...into.moved.filter((m) => m.kind === kind).map(({ copyId }) => copyId),
  ];
  const withdrawn = await modelOf(kind)
    .find({ [idField]: { $nin: answered } })
    .lean();
  for (const read of withdrawn) {
    const entry = { kind, id: read[idField], version: null };
    try {
      // eslint-disable-next-line no-await-in-loop
      report(into, entry, await withdrawOne(kind, read, context));
    } catch (err) {
      logger.warn(`[skills-follow] ${kind} ${entry.id}: ${err.message}`);
      into.failed.push({ ...entry, code: codeOf(err) });
    }
  }
}

/**
 * Follows production (ADR 0019): one follow at a time, on this instance and
 * any other sharing its database; reads production's answer, then applies
 * it, expertises first, each item on its own, so one failing stops nothing
 * else. An answer that cannot be fetched or read writes nothing. Each
 * follow is recorded.
 *
 * @param {Object} options
 * @param {() => Promise<Object>} options.fetchExport production's answer
 * @param {{ id?: string, name?: string }} options.actor who follows
 * @param {'manual'|'night'} [options.trigger] a person's button, or the night
 * @returns {Promise<Object>} the report: `status` (`succeeded`, `partial`,
 *   `failed`), `origin`, and the lists `created`, `updated`, `upToDate`,
 *   `kept` (with a `reason`, and `productionChanged` for an item kept on the
 *   copy), `moved` (with the `copyId` the copy's work went to), `removed`
 *   (a draft, `scope: 'draft'` with its `version`, or the whole item,
 *   `scope: 'item'`) and `failed`
 *   (with a `code`), each of `{ kind, id, version }`, a skill's with the
 *   `warnings` of the expertises it consumes and the copy lacks
 * @throws {HttpError} 409 SKILLS_FOLLOW_RUNNING while another follow runs
 */
async function followProduction({ fetchExport, actor, trigger = 'manual' }) {
  const startedAt = new Date();
  const lock = await takeLock({ actor, trigger, startedAt });
  let answer;
  try {
    answer = readProductionAnswer(await fetchExport());
  } catch (err) {
    const reason = err.reason || 'unreachable';
    return record(lock, {
      ...emptyReport(),
      status: 'failed',
      // A word and a code the page translates; anything unforeseen reads
      // "unreachable".
      reason,
      code: err.reason ? err.code : ERROR_CODES.SKILLS_FOLLOW_UNREACHABLE,
      message: err.message,
    });
  }

  const into = { ...emptyReport(), origin: answer.origin };
  answer.rejected.forEach(({ kind, id, code, field }) =>
    into.failed.push({ kind, id, version: null, code, field })
  );
  const context = { actor, now: startedAt };
  for (const kind of KINDS) {
    // eslint-disable-next-line no-await-in-loop
    await applyKind(kind, answer, into, context);
  }
  into.status = into.failed.length ? 'partial' : 'succeeded';
  return record(lock, into);
}

module.exports = { followProduction };
