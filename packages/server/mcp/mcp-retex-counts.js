'use strict';

// The open retex of what a super admin reads (ADR 0021): retex of client users
// wait for a super admin, who learns of them as they read a skill or an
// expertise, and may consolidate them then.

const { McpRetexes } = require('../common/models.common.js');
const { mayWrite } = require('./mcp-identity.js');

/**
 * The items, each with how many open retex it has, for whoever may read the
 * retex; the items as they are for anyone else.
 *
 * @param {'skill'|'expertise'} kind
 * @param {Object[]} items what a tool answers
 * @param {string} idField `skillId` or `expertiseId`
 * @param {{ user: Object, group: Object, authInfo: Object }} caller
 * @returns {Promise<Object[]>}
 */
async function withOpenRetex(kind, items, idField, { user, group, authInfo }) {
  if (!items.length || !mayWrite(user, group, authInfo)) return items;
  const open = await McpRetexes.find(
    {
      status: 'open',
      'about.kind': kind,
      'about.id': { $in: items.map((item) => item[idField]) },
    },
    { about: 1 }
  ).lean();
  const counts = new Map();
  open.forEach(({ about }) =>
    counts.set(about.id, (counts.get(about.id) || 0) + 1)
  );
  return items.map((item) => ({
    ...item,
    openRetex: counts.get(item[idField]) || 0,
  }));
}

module.exports = { withOpenRetex };
