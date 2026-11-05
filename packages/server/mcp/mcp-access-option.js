'use strict';

const { switchChangeOf } = require('../group/group-switch.js');
const {
  recordSecurityEvent,
} = require('../two-factor/security-event.service.js');
const { MCP_ACCESS_ACTIONS } = require('./mcp-access.constants.js');

/**
 * Before a group update: keeps `enableMcp` a boolean, and tells whether the
 * update turns the company's MCP access on or off.
 *
 * @param {string} groupId
 * @param {Object} payload the update, changed in place
 * @returns {Promise<boolean|null>} the new value when it changes, else null
 */
function mcpAccessChangeOf(groupId, payload) {
  return switchChangeOf(groupId, payload, 'enableMcp');
}

/**
 * After the update: records who turned MCP access on or off, as for the
 * two-factor requirement. It opens the company's data to its members' AI
 * assistants.
 *
 * @param {Object} actor the request user
 * @param {string} groupId
 * @param {boolean|null} change from mcpAccessChangeOf
 * @returns {Promise<void>}
 */
async function recordMcpAccessChange(actor, groupId, change) {
  if (change === null) return;
  await recordSecurityEvent({
    action: change ? MCP_ACCESS_ACTIONS.ENABLED : MCP_ACCESS_ACTIONS.DISABLED,
    actor: actor.id,
    group: groupId,
  });
}

module.exports = { mcpAccessChangeOf, recordMcpAccessChange };
