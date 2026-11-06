'use strict';

/**
 * How a draft of a skill or an expertise is written without writing over a
 * change made since it was read (ADR 0014), in both directions. An assistant
 * has one draft open at a time, and every write it makes is conditioned on
 * what it read, so two changes sent at once never start two drafts, nor
 * write over each other without saying so. A person's save and publication
 * (versioned-entity.service.js) are conditioned on the draft their screen
 * read the same way.
 */

const createError = require('http-errors');
const { SkillStatuses } = require('../constant/skill-constants.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const {
  findVersion,
  findActiveVersion,
  assertDraft,
  openDraftOf,
  versionLabel,
  laterThan,
} = require('./version-helpers.js');

// The errors of a save whose condition no longer matched the document.
const CONFLICTS = new Set(['DocumentNotFoundError', 'VersionError']);

const CHANGED =
  'The draft changed since it was read: read it again and send the proposal again.';

/**
 * The draft a change goes to, when there is one: the open draft (the latest
 * one newer than the active version). A major change is never written into
 * an open minor, and an archived document takes no draft.
 *
 * @returns {Object|null} the open draft, or null when one is to be started
 * @throws {HttpError} 409
 */
function draftToWrite(doc, id, major) {
  if (doc.status === SkillStatuses.ARCHIVED) {
    throw createError(409, `"${id}" is archived: it takes no new draft.`);
  }
  const open = openDraftOf(doc);
  if (open && major && open.versionMinor > 0) {
    throw createError(
      409,
      `The minor draft ${versionLabel(
        open
      )} is open: propose this change to it, or ask a person to publish or discard it before a major version.`
    );
  }
  return open;
}

/**
 * A version's update date as the database stores it: none for a version
 * stored before it had one, which the schema's default fills in on reading.
 *
 * @param {Object} version
 * @returns {Date|null}
 */
function storedUpdatedAt(version) {
  if (typeof version.$isDefault === 'function') {
    if (version.$isDefault('updatedAt')) return null;
  }
  return version.updatedAt || null;
}

/**
 * The condition a write puts on the version it read: still a draft, with the
 * update date read, or none, for one stored before it had one.
 *
 * @param {Object} version
 * @param {Date|null} readAt from storedUpdatedAt
 * @returns {Object} an `$elemMatch` on `versions`
 */
function unchangedDraft(version, readAt) {
  return {
    $elemMatch: {
      versionMajor: version.versionMajor,
      versionMinor: version.versionMinor,
      status: SkillStatuses.DRAFT,
      updatedAt: { $in: [readAt, null] },
    },
  };
}

/**
 * The update date of a draft as stored, checked against the one the
 * person's screen read (`sent`, from the request): a 409 when the draft was
 * written since, by an assistant or another person (ADR 0014). A request
 * without one, from a client older than this check, writes as before.
 *
 * @returns {Date|null} the update date the write is conditioned on
 */
function readAtOf(version, sent) {
  const stored = storedUpdatedAt(version);
  const told = sent === undefined || sent === null || sent === '';
  if (!told && stored && new Date(sent).getTime() !== stored.getTime()) {
    throw createError(409, ERROR_CODES.SKILL_VERSION_CHANGED);
  }
  return stored;
}

// Saves the document on the condition that the draft is as it was read,
// so a write made meanwhile is never written over.
async function saveIfUnchanged(doc, version, readAt) {
  // eslint-disable-next-line no-param-reassign
  doc.$where = { versions: unchangedDraft(version, readAt) };
  try {
    await doc.save();
  } catch (err) {
    // Mongoose says a save matched nothing as either, by what it changed.
    if (err && CONFLICTS.has(err.name)) {
      throw createError(409, ERROR_CODES.SKILL_VERSION_CHANGED);
    }
    throw err;
  } finally {
    // eslint-disable-next-line no-param-reassign
    doc.$where = undefined;
  }
}

// A plain copy of a version, as the database stores it.
const plain = (version) =>
  typeof version.toObject === 'function' ? version.toObject() : { ...version };

/**
 * @param {Object} options what the entity's service gives:
 * @param {import('mongoose').Model} options.model
 * @param {string} options.idField
 * @param {string} options.entityNoun
 * @param {Function} options.getDoc the document, or a 404
 * @param {Function} options.minorDraftOf `(doc, active, userId)`
 * @param {Function} options.majorDraftOf `(doc, seed, userId)`
 * @param {string[]} options.patchable the fields a draft's change may set
 */
function createDraftWriter({
  model,
  idField,
  entityNoun,
  getDoc,
  minorDraftOf,
  majorDraftOf,
  patchable,
}) {
  /**
   * The open draft, or a new one started from the active version, a minor
   * unless a major is asked or nothing is published yet. A draft is started
   * on the condition that the versions did not change since they were read:
   * of two changes made at once, the second goes to the draft the first
   * started.
   *
   * @param {string} id
   * @param {Object} [options]
   * @param {boolean} [options.major]
   * @param {*} [options.userId]
   * @returns {Promise<{doc: Object, version: Object}>} the document and its
   *   draft, as read
   * @throws {HttpError} 404, or 409 when the document is archived, when a
   *   major is asked while a minor draft is open, or when it changed in a
   *   way that leaves no draft to write
   */
  async function openOrStartDraft(id, { major = false, userId } = {}) {
    const doc = await getDoc(id);
    const open = draftToWrite(doc, id, major);
    if (open) return { doc, version: open };

    const active = findActiveVersion(doc);
    const draft =
      major || !active
        ? majorDraftOf(doc, active, userId)
        : minorDraftOf(doc, active, userId);
    const written = await model.findOneAndUpdate(
      {
        [idField]: id,
        status: { $ne: SkillStatuses.ARCHIVED },
        versions: { $size: (doc.versions || []).length },
      },
      { $push: { versions: draft } },
      { new: true }
    );
    if (written) {
      return {
        doc: written,
        version: findVersion(written, draft.versionMajor, draft.versionMinor),
      };
    }
    // Another write came first: the draft it started is the one to write.
    const now = await getDoc(id);
    const started = draftToWrite(now, id, major);
    if (started) return { doc: now, version: started };
    throw createError(
      409,
      `The ${entityNoun} "${id}" changed while the draft was started: send the change again.`
    );
  }

  /**
   * Writes a change into a draft as openOrStartDraft read it, on the
   * condition that the draft was not written since (its update date): a
   * change made meanwhile, by a person or another proposal, is never written
   * over. The document is validated first, as a save would be: the schema
   * refuses what it refuses, and derives what it derives (an expertise's
   * sections).
   *
   * @param {Object} doc the document, as read
   * @param {Object} version its draft, as read
   * @param {Object} patch the fields to set, among the patchable ones
   * @param {*} userId
   * @returns {Promise<Object>} the document written
   * @throws {HttpError} 400 when the schema refuses the change, 409 when the
   *   draft changed since it was read
   */
  async function writeDraftIfUnchanged(doc, version, patch, userId) {
    assertDraft(version);
    const readAt = storedUpdatedAt(version);
    patchable.forEach((key) => {
      if (patch[key] !== undefined) version[key] = patch[key];
    });
    version.updatedBy = userId;
    version.updatedAt = laterThan(readAt);
    await doc.validate();

    const written = await model.findOneAndUpdate(
      {
        [idField]: doc[idField],
        // Archived meanwhile, it takes no more drafts, as openOrStartDraft
        // refuses to start one.
        status: { $ne: SkillStatuses.ARCHIVED },
        versions: unchangedDraft(version, readAt),
      },
      { $set: { 'versions.$': plain(version) } },
      { new: true }
    );
    if (written) return written;
    const now = await getDoc(doc[idField]);
    draftToWrite(now, doc[idField], false);
    throw createError(409, CHANGED);
  }

  return { openOrStartDraft, writeDraftIfUnchanged };
}

module.exports = {
  createDraftWriter,
  draftToWrite,
  storedUpdatedAt,
  unchangedDraft,
  readAtOf,
  saveIfUnchanged,
};
