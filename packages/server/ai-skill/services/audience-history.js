'use strict';

/**
 * Changing the audience of a skill or an expertise keeps the change (ADR
 * 0031): which way it went, when, and who set it, so the openings and
 * withdrawals are dated. Every write of an audience goes through here.
 */

/**
 * Sets an item's audience, and records the change when it is one.
 *
 * @param {Object} doc the item, stored or plain, saved by the caller
 * @param {string} audience
 * @param {*} [userId] who sets it
 * @param {Date} [at] when, the same date as what is written with it
 * @returns {boolean} whether it changed
 */
function setAudience(doc, audience, userId, at = new Date()) {
  /* eslint-disable no-param-reassign */
  if (doc.audience === audience) return false;
  doc.audience = audience;
  doc.audienceHistory = [
    ...(doc.audienceHistory || []),
    { audience, at, _by: userId || null },
  ];
  /* eslint-enable no-param-reassign */
  return true;
}

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

module.exports = { setAudience, audienceUpdate };
