'use strict';

/**
 * Changing the audience of a skill or an expertise keeps the change (ADR
 * 0031): which way it went, when, and who set it, so the openings and
 * withdrawals are dated. Archiving an item and publishing it again are kept
 * the same way: an archived item is withdrawn from every company that read
 * it. Every write of an audience or of an archiving goes through here, the
 * follow of a copy included (`skills-follow-apply.js`).
 *
 * The history is only ever added to (`push`), so a write made at the same
 * time on the same item, an expertise opened with a skill, is not lost.
 */

const createError = require('http-errors');
const ERROR_CODES = require('../../constant/error-codes.js');
const { SkillStatuses, Audiences } = require('../constant/skill-constants.js');
const { findActiveVersion } = require('./version-helpers.js');

/* eslint-disable no-param-reassign */
function record(doc, entry) {
  if (!doc.audienceHistory) doc.audienceHistory = [];
  doc.audienceHistory.push(entry);
}

/**
 * Sets an item's audience, and records the change when it is one. A company
 * reads the active version only: an item never published is never opened,
 * nor an archived one until a version of it is published again, from the
 * back office as from an assistant (`set_audience`).
 *
 * @param {Object} doc the item, stored or plain, with its versions, saved by
 *   the caller
 * @param {string} audience
 * @param {*} [userId] who sets it
 * @param {Date} [at] when, the same date as what is written with it
 * @returns {boolean} whether it changed
 * @throws {HttpError} 409 SKILL_OPEN_ARCHIVED, SKILL_OPEN_NEVER_PUBLISHED
 */
function setAudience(doc, audience, userId, at = new Date()) {
  if (doc.audience === audience) return false;
  if (audience === Audiences.ALL && doc.status === SkillStatuses.ARCHIVED) {
    throw createError(409, ERROR_CODES.SKILL_OPEN_ARCHIVED);
  }
  if (audience === Audiences.ALL && !findActiveVersion(doc)) {
    throw createError(409, ERROR_CODES.SKILL_OPEN_NEVER_PUBLISHED);
  }
  doc.audience = audience;
  record(doc, { audience, at, _by: userId || null });
  return true;
}

/**
 * Archives an item, or makes it active again, and records the change when
 * it is one: `archivedAt` is when it was archived, set only as it is, and
 * cleared once it is published again.
 *
 * @param {Object} doc the item, stored or plain, saved by the caller
 * @param {boolean} archived
 * @param {*} [userId] who does it
 * @param {Date} [at] when, the same date as what is written with it
 * @returns {boolean} whether it changed
 */
function setArchived(doc, archived, userId, at = new Date()) {
  const was = doc.status === SkillStatuses.ARCHIVED;
  doc.status = archived ? SkillStatuses.ARCHIVED : SkillStatuses.ACTIVE;
  if (was === archived) return false;
  doc.archivedAt = archived ? at : null;
  record(doc, { audience: doc.audience, archived, at, _by: userId || null });
  return true;
}
/* eslint-enable no-param-reassign */

/**
 * The update that sets the audience of items read from the database, for
 * those only that are not at it already: `{ filter, update }` to add to an
 * `updateMany`.
 */
function audienceUpdate(audience, userId, at = new Date()) {
  return {
    filter: { audience: { $ne: audience } },
    update: {
      $set: { audience },
      $push: { audienceHistory: { audience, at, _by: userId || null } },
    },
  };
}

module.exports = { setAudience, setArchived, audienceUpdate };
