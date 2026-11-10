'use strict';

// The open retex of what a super admin reads (ADR 0021): retex of client users
// wait for a super admin, who learns of them as they read a skill or an
// expertise, and may consolidate them then.

const { McpRetexes } = require('../common/models.common.js');
const { isConsultant } = require('./mcp-identity.js');

/**
 * The items, each with how many open retex it has, for whoever may read the
 * retex; the items as they are for anyone else.
 *
 * @param {'skill'|'expertise'} kind
 * @param {Object[]} items what a tool answers
 * @param {string} idField `skillId` or `expertiseId`
 * @param {{ user: Object }} caller
 * @returns {Promise<Object[]>}
 */
async function withOpenRetex(kind, items, idField, { user }) {
  if (!items.length || !isConsultant(user)) return items;
  // Counted by the database, the retex never read.
  const open = await McpRetexes.aggregate([
    {
      $match: {
        status: 'open',
        'about.kind': kind,
        'about.id': { $in: items.map((item) => String(item[idField])) },
      },
    },
    { $group: { _id: '$about.id', open: { $sum: 1 } } },
  ]);
  const counts = new Map(open.map((count) => [count._id, count.open]));
  return items.map((item) => ({
    ...item,
    openRetex: counts.get(item[idField]) || 0,
  }));
}

module.exports = { withOpenRetex };
