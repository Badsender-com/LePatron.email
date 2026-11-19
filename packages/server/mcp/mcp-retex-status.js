'use strict';

// Closing a retex (ADR 0021): addressed by a published version, or dismissed
// with a reason. A closed retex no longer counts towards a convergence, and
// follows its company's log retention from the day it was closed.

const { McpRetexes, Groups } = require('../common/models.common.js');
const { computeExpiresAt } = require('../group/log-retention.js');
const { isObjectIdString } = require('../utils/model.js');

// The ids that may be a retex's: an assistant may send anything.
const asIds = (ids) => ids.map(String).filter(isObjectIdString);

// The retention of each company, read once.
async function retentionsOf(companyIds) {
  const ids = [...new Set(companyIds.map(String))];
  const groups = await Groups.find(
    { _id: { $in: ids } },
    { logRetentionDays: 1 }
  ).lean();
  return new Map(groups.map((g) => [String(g._id), g.logRetentionDays]));
}

/**
 * Closes the open retex among `ids`, each with its company's retention from
 * now. The others are left as they are.
 *
 * @param {string[]} ids
 * @param {Object} changes what the closing sets: `status`, and `addressedIn`
 *   or `dismissal`
 * @returns {Promise<string[]>} the ids closed
 */
async function closeRetex(ids, changes) {
  const open = await McpRetexes.find(
    { _id: { $in: asIds(ids) }, status: 'open' },
    { _company: 1 }
  ).lean();
  if (!open.length) return [];
  const retentions = await retentionsOf(open.map((r) => r._company));
  const closedAt = new Date();
  const results = await Promise.all(
    open.map((retex) =>
      McpRetexes.updateOne(
        { _id: retex._id, status: 'open' },
        {
          $set: {
            ...changes,
            closedAt,
            expiresAt: computeExpiresAt(
              closedAt,
              retentions.get(String(retex._company))
            ),
          },
        }
      )
    )
  );
  // Only those this call closed: another may have closed one meanwhile.
  return open
    .filter(
      (_retex, i) => (results[i].nModified ?? results[i].modifiedCount) === 1
    )
    .map((retex) => String(retex._id));
}

/**
 * The open retex among `ids`, or the ids that are not: unknown, or closed.
 *
 * @param {string[]} ids
 * @returns {Promise<string[]>} the ids that may not be cited
 */
async function notOpen(ids) {
  const open = await McpRetexes.find(
    { _id: { $in: asIds(ids) }, status: 'open' },
    { _id: 1 }
  ).lean();
  const found = new Set(open.map((r) => String(r._id)));
  return ids.map(String).filter((id) => !found.has(id));
}

module.exports = { closeRetex, notOpen };
