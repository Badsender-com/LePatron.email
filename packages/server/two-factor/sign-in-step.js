'use strict';

const { Users } = require('../common/models.common.js');
const { isBootstrapAccount } = require('../account/bootstrap-account.js');
const { needsTwoFactor } = require('./two-factor.policy.js');
const pendingStep = require('./pending-step.js');
const { STEPS } = require('./two-factor.constants.js');

/**
 * What comes after a right password (ADR 0008): nothing, and the session
 * opens, or the step of the code, or the setup. The account stays signed out
 * until that step is done.
 *
 * @param {Object} req
 * @param {Object} res
 * @param {Object} account the account passport accepted
 * @returns {Promise<Object|null>} `{ step, method }` for the answer, or null
 */
async function stepAfterPassword(req, res, account) {
  // A step left by an earlier attempt never carries over.
  pendingStep.end(req);
  if (isBootstrapAccount(account)) return null;

  const user = await Users.findById(account.id).select('+twoFactor');
  if (!user || !(await needsTwoFactor(user))) return null;

  if (!user.twoFactorMethod) {
    pendingStep.start(req, user, STEPS.SETUP);
    return { step: STEPS.SETUP };
  }
  pendingStep.start(req, user, STEPS.VERIFY, user.twoFactorMethod);
  return { step: STEPS.VERIFY, method: user.twoFactorMethod };
}

module.exports = { stepAfterPassword };
