'use strict';

const {
  recordSecurityEvent,
} = require('../two-factor/security-event.service.js');
const { MCP_ACCESS_ACTIONS } = require('./mcp-access.constants.js');

/**
 * Records who turned MCP access on or off, as for the two-factor
 * requirement. It opens the company's data to its members' AI assistants.
 *
 * @param {Object} actor the request user
 * @param {string} groupId
 * @param {boolean} [change] the new value, from writeSwitches (group-switch.js);
 *   none when the switch did not change
 * @returns {Promise<void>}
 */
async function recordMcpAccessChange(actor, groupId, change) {
  if (change === undefined) return;
  await recordSecurityEvent({
    action: change ? MCP_ACCESS_ACTIONS.ENABLED : MCP_ACCESS_ACTIONS.DISABLED,
    actor: actor.id,
    group: groupId,
  });
}

module.exports = { recordMcpAccessChange };
