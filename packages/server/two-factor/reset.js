'use strict';

const createError = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');
const { Users } = require('../common/models.common.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const { endSessions } = require('../account/sign-in.js');
const { normalizeString } = require('../utils/model.js');
const { recordSecurityEvent } = require('./security-event.service.js');
const { sendTwoFactorEmail } = require('./two-factor.emails.js');
const { METHODS, SECURITY_ACTIONS } = require('./two-factor.constants.js');

// Getting past a member's second factor is a tech admin's or a super admin's
// (ADR 0008): the reset, and the change of the address an emailed code goes
// to, which resets it.

/**
 * Erases the member's setup and trusted devices, ends their sessions and
 * records who did it. The member sets it up again at their next sign-in.
 *
 * @param {Object} actor the request user
 * @param {Object} user the member
 * @returns {Promise<void>}
 */
async function eraseSetup(actor, user) {
  // Explicitly: the account was read without its `twoFactor`, so unsetting
  // it on the document would write nothing.
  await Users.updateOne(
    { _id: user._id },
    { $unset: { twoFactor: 1, twoFactorMethod: 1 } }
  );
  await endSessions(user.id);
  await recordSecurityEvent({
    action: SECURITY_ACTIONS.RESET,
    user: user.id,
    actor: actor.id,
  });
}

/**
 * Before an admin's update of an account: changing the address of an
 * account that has set up two-factor authentication needs the technical
 * settings of the group.
 *
 * @param {Object} actor the request user
 * @param {Object} target the account, as stored before the update
 * @param {Object} userParams the fields the update writes
 * @returns {boolean} whether the update resets the setup: the codes of an
 *   emailed method would otherwise go to the new address
 * @throws {Forbidden} for an actor without `group.manage-tech`
 */
function emailChangeResets(actor, target, userParams) {
  if (!('email' in userParams) || !target.twoFactorMethod) return false;
  if (normalizeString(userParams.email) === target.email) return false;
  if (!permissions.can(actor, CAPABILITIES.GROUP_MANAGE_TECH)) {
    throw new createError.Forbidden(ERROR_CODES.FORBIDDEN_CAPABILITY);
  }
  return target.twoFactorMethod === METHODS.EMAIL;
}

/**
 * After the address changed: resets the setup, and tells the previous
 * address.
 *
 * @param {Object} actor the request user
 * @param {Object} target the account, as stored before the update
 * @returns {Promise<void>}
 */
async function resetAfterEmailChange(actor, target) {
  await eraseSetup(actor, target);
  await sendTwoFactorEmail(target, 'emailChanged');
}

module.exports = { eraseSetup, emailChangeResets, resetAfterEmailChange };
