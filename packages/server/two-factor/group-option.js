'use strict';

const { recordSecurityEvent } = require('./security-event.service.js');
const { SECURITY_ACTIONS } = require('./two-factor.constants.js');

/**
 * Records who switched the option, and which way.
 *
 * @param {Object} actor the request user
 * @param {string} groupId
 * @param {boolean} [change] the new value, from writeSwitches (group-switch.js);
 *   none when the switch did not change
 * @returns {Promise<void>}
 */
async function recordRequirementChange(actor, groupId, change) {
  if (change === undefined) return;
  await recordSecurityEvent({
    action: change ? SECURITY_ACTIONS.REQUIRED : SECURITY_ACTIONS.NOT_REQUIRED,
    actor: actor.id,
    group: groupId,
  });
}

module.exports = { recordRequirementChange };
