'use strict';

const { McpFeedbacks } = require('../common/models.common.js');
const {
  recordSecurityEvent,
} = require('../security-event/security-event.service.js');
const {
  MCP_ACCESS_ACTIONS,
  RETEX_ACTIONS,
} = require('../security-event/security-event.actions.js');

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

/**
 * Records who allowed or stopped the retex (ADR 0012): it lets the summaries
 * of the company's assistant sessions be kept for the platform company.
 *
 * @param {Object} actor the request user
 * @param {string} groupId
 * @param {boolean} [change] the new value, from writeSwitches; none when the
 *   switch did not change
 * @returns {Promise<void>}
 */
async function recordRetexChange(actor, groupId, change) {
  if (change === undefined) return;
  await recordSecurityEvent({
    action: change ? RETEX_ACTIONS.ALLOWED : RETEX_ACTIONS.DISALLOWED,
    actor: actor.id,
    group: groupId,
  });
}

/**
 * Forgets the session summaries kept for the platform company from a
 * company's feedbacks, when the company stops the retex (ADR 0012). The
 * feedbacks stay, with their rating and their comment.
 *
 * @param {string} groupId
 * @returns {Promise<void>}
 */
async function forgetRetex(groupId) {
  await McpFeedbacks.updateMany(
    { _company: groupId, retex: { $ne: null } },
    { $set: { retex: null } }
  );
}

module.exports = { recordMcpAccessChange, recordRetexChange, forgetRetex };
