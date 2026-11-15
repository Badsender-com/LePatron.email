'use strict';

const crypto = require('crypto');
const { Conflict } = require('http-errors');

const { TaxonomyDimensions } = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');

/**
 * One write at a time on a dimension (ADR-0026). A bulk write is validated
 * against what is stored, then written value by value: two saves of one
 * matrix running together could each pass and leave two defaults under one
 * parent value. A write claims the dimensions it changes first; a second one
 * meanwhile is refused, never queued, and the admin saves again.
 *
 * A claim lapses on its own, so a server stopped mid-write locks nothing for
 * long, and is released only by the write holding it.
 */
const LOCK_MS = 30 * 1000;

module.exports = { withDimensionsLocked, LOCK_MS };

const free = (now) => ({
  $or: [
    { writeLockUntil: { $exists: false } },
    { writeLockUntil: null },
    { writeLockUntil: { $lt: now } },
  ],
});

/**
 * @param {Object} params
 * @param {*} params.companyId
 * @param {string[]} params.names the dimensions the write changes
 * @param {Function} write run once they are all claimed
 * @returns {Promise<*>} what `write` returns
 * @throws {Conflict} TAXONOMY_WRITE_IN_PROGRESS while another write holds one
 */
async function withDimensionsLocked({ companyId, names }, write) {
  const token = crypto.randomBytes(12).toString('hex');
  const claimed = [];
  try {
    // Always in the same order: two writes on overlapping dimensions meet on
    // the first one they share.
    for (const name of [...new Set(names)].sort()) {
      const now = new Date();
      const lock = await TaxonomyDimensions.findOneAndUpdate(
        { _company: companyId, name, ...free(now) },
        {
          $set: {
            writeLockUntil: new Date(now.getTime() + LOCK_MS),
            writeLockToken: token,
          },
        },
        // A claim is not an edit of the dimension.
        { timestamps: false }
      );
      if (lock) {
        claimed.push(name);
      } else if (
        await TaxonomyDimensions.exists({ _company: companyId, name })
      ) {
        throw new Conflict(ERROR_CODES.TAXONOMY_WRITE_IN_PROGRESS);
      }
      // A name the company does not have claims nothing: the write refuses
      // it as it refuses any list it does not expect.
    }
    return await write();
  } finally {
    if (claimed.length > 0) {
      await TaxonomyDimensions.updateMany(
        { _company: companyId, name: { $in: claimed }, writeLockToken: token },
        { $set: { writeLockUntil: null, writeLockToken: null } },
        { timestamps: false }
      );
    }
  }
}
