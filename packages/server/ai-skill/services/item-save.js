'use strict';

/**
 * Saving a skill or an expertise itself, its identity or its audience, on the
 * condition that it is as it was read (`readAt`, its `updatedAt`), so a write
 * made meanwhile is never written over (ADR 0014).
 */

const createError = require('http-errors');
const ERROR_CODES = require('../../constant/error-codes.js');
const { laterThan } = require('./version-helpers.js');

// Mongoose says a save matched nothing as either, by what it changed.
const CONFLICTS = new Set(['DocumentNotFoundError', 'VersionError']);

/**
 * @param {Object} doc the stored item, as read
 * @param {{ readAt?: Date|string }} [options] `readAt`: when it was last
 *   written, as read
 * @returns {Promise<Object>} the item saved
 * @throws {HttpError} 409 `SKILL_ITEM_CHANGED` when it was written since
 */
async function saveItem(doc, { readAt } = {}) {
  /* eslint-disable no-param-reassign */
  // Said here too, where timestamps do not run: the next read sees a write.
  doc.updatedAt = laterThan(readAt);
  if (!readAt) {
    await doc.save();
    return doc;
  }
  doc.$where = { updatedAt: new Date(readAt) };
  try {
    await doc.save();
  } catch (err) {
    if (err && CONFLICTS.has(err.name)) {
      throw createError(409, ERROR_CODES.SKILL_ITEM_CHANGED);
    }
    throw err;
  } finally {
    doc.$where = undefined;
  }
  /* eslint-enable no-param-reassign */
  return doc;
}

module.exports = { saveItem };
