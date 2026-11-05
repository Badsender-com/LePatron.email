'use strict';

const { switchChangeOf } = require('../group/group-switch.js');
const { recordSecurityEvent } = require('./security-event.service.js');
const { SECURITY_ACTIONS } = require('./two-factor.constants.js');

/**
 * Before a group update: keeps `requireTwoFactor` a boolean, and tells
 * whether the update switches it.
 *
 * @param {string} groupId
 * @param {Object} payload the update, changed in place
 * @returns {Promise<boolean|null>} the new value when it changes, else null
 */
function requirementChangeOf(groupId, payload) {
  return switchChangeOf(groupId, payload, 'requireTwoFactor');
}

/**
 * After the update: records who switched the option, and which way.
 *
 * @param {Object} actor the request user
 * @param {string} groupId
 * @param {boolean|null} change from requirementChangeOf
 * @returns {Promise<void>}
 */
async function recordRequirementChange(actor, groupId, change) {
  if (change === null) return;
  await recordSecurityEvent({
    action: change ? SECURITY_ACTIONS.REQUIRED : SECURITY_ACTIONS.NOT_REQUIRED,
    actor: actor.id,
    group: groupId,
  });
}

module.exports = { requirementChangeOf, recordRequirementChange };
