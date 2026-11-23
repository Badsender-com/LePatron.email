'use strict';

const {
  recordSecurityEvent,
} = require('../../security-event/security-event.service.js');
const {
  AI_LOG_CONTENT_ACTIONS,
} = require('../../security-event/security-event.actions.js');

/**
 * Records who decided whether the company's AI invocation logs keep their
 * content (`Group.logSkillInvocationContent`), and which way.
 *
 * @param {Object} actor the request user
 * @param {string} groupId
 * @param {boolean} [change] the new value, from writeSwitches
 *   (group/group-switch.js); none when the switch did not change
 * @returns {Promise<void>}
 */
async function recordLogContentChange(actor, groupId, change) {
  if (change === undefined) return;
  await recordSecurityEvent({
    action: change
      ? AI_LOG_CONTENT_ACTIONS.KEPT
      : AI_LOG_CONTENT_ACTIONS.NOT_KEPT,
    actor: actor.id,
    group: groupId,
  });
}

module.exports = { recordLogContentChange };
