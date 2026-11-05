'use strict';

const { Groups } = require('../common/models.common.js');

/**
 * Before a group update: keeps one of the company's switches (two-factor
 * authentication, MCP access) a boolean, and tells whether the update turns
 * it. A switch is true only when the request says `true`: a string, a number
 * or an object would otherwise be cast by Mongoose, `'yes'` turning it on.
 *
 * @param {string} groupId
 * @param {Object} payload the update, changed in place
 * @param {string} field the switch, a boolean field of the group
 * @returns {Promise<boolean|null>} the new value when it changes, else null
 */
async function switchChangeOf(groupId, payload, field) {
  if (!(field in payload)) return null;
  payload[field] = payload[field] === true;
  const stored = await Groups.findById(groupId, { [field]: 1 }).lean();
  const before = Boolean(stored && stored[field]);
  return before === payload[field] ? null : payload[field];
}

module.exports = { switchChangeOf };
