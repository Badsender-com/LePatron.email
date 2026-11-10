'use strict';

/**
 * A change that ends or starts a feature's use of an item without publishing
 * a version (ADR 0019): the scope or the category of an active expertise, an
 * item archived. Nothing is replayed: the change answers its impact as
 * warnings, and is traced on the item in the same write. Archiving a skill a
 * feature calls is confirmed first.
 */

const createError = require('http-errors');
const ERROR_CODES = require('../../constant/error-codes.js');
const { SkillStatuses } = require('../constant/skill-constants.js');
const { featuresUsing } = require('./feature-use.js');

// The codes of what such a change warns of (`aiSkills.warnings.*`).
const USAGE_WARNINGS = Object.freeze({
  LOST: 'USED_BY_FEATURES_LOST',
  GAINED: 'USED_BY_FEATURES_GAINED',
});

const typesOf = (features) => features.map((f) => f.featureType);

function diffOf(before, after) {
  const was = typesOf(before);
  const is = typesOf(after);
  return {
    lost: before.filter((f) => !is.includes(f.featureType)),
    gained: after.filter((f) => !was.includes(f.featureType)),
  };
}

// Kept on the item, saved with the change itself.
function trace(doc, change, { lost, gained }, userId) {
  if (!lost.length && !gained.length) return [];
  // eslint-disable-next-line no-param-reassign
  doc.usageHistory = [
    ...(doc.usageHistory || []),
    {
      change,
      by: userId,
      at: new Date(),
      lost: typesOf(lost),
      gained: typesOf(gained),
    },
  ];
  const warning = (code, features) =>
    features.length
      ? [{ code, features: features.map((f) => f.description) }]
      : [];
  return [
    ...warning(USAGE_WARNINGS.LOST, lost),
    ...warning(USAGE_WARNINGS.GAINED, gained),
  ];
}

/**
 * Watches a change of an item's attributes: read before it is applied, then
 * settled on the item as changed, before it is saved. Only an active item
 * is loaded by a feature.
 *
 * @param {'skill'|'expertise'} kind
 * @param {Object} doc the item as read
 * @returns {(changed: Object, userId: string) => Object[]} the warnings
 */
function watchUsage(kind, doc) {
  const wasActive = doc.status === SkillStatuses.ACTIVE;
  const before = featuresUsing(kind, doc);
  return (changed, userId) =>
    wasActive
      ? trace(
          changed,
          'identity',
          diffOf(before, featuresUsing(kind, changed)),
          userId
        )
      : [];
}

/**
 * What archiving an item does to the features that use it, on the item read
 * before it is archived.
 *
 * @param {'skill'|'expertise'} kind
 * @param {Object} doc
 * @param {{ confirmUsedBy?: boolean, userId?: string }} options
 * @returns {Object[]} the warnings
 * @throws {HttpError} 409 `SKILL_ARCHIVE_CONFIRMATION_REQUIRED`, with the
 *   features (`usedBy`), for a skill a feature calls, unconfirmed
 */
function archiveUsage(kind, doc, { confirmUsedBy = false, userId } = {}) {
  const usedBy = featuresUsing(kind, doc);
  if (kind === 'skill' && usedBy.length && confirmUsedBy !== true) {
    throw createError(409, ERROR_CODES.SKILL_ARCHIVE_CONFIRMATION_REQUIRED, {
      usedBy,
    });
  }
  return trace(doc, 'archived', { lost: usedBy, gained: [] }, userId);
}

module.exports = { USAGE_WARNINGS, archiveUsage, watchUsage };
