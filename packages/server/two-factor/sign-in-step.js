'use strict';

const { Users } = require('../common/models.common.js');
const { isBootstrapAccount } = require('../account/bootstrap-account.js');
const { needsTwoFactor } = require('./two-factor.policy.js');
const pendingStep = require('./pending-step.js');
const { isTrustedDevice } = require('./trusted-device.js');
const { sendEmailCode } = require('./email-code.js');
const { renewSession } = require('../account/sign-in.js');
const logger = require('../utils/logger.js');
const { STEPS, METHODS } = require('./two-factor.constants.js');

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

  // The step lives in a session issued with this answer, never in the one
  // the browser came with.
  const startStep = async (step, method) => {
    await renewSession(req);
    return pendingStep.start(req, user, step, method);
  };

  if (!user.twoFactorMethod) {
    await startStep(STEPS.SETUP);
    return { step: STEPS.SETUP };
  }
  if (isTrustedDevice(user, req)) {
    user.twoFactor.failedPasswords = 0;
    await user.save();
    return null;
  }
  const pending = await startStep(STEPS.VERIFY, user.twoFactorMethod);
  // The first code by email leaves with the answer. Past the budget, the
  // member asks for one again later; the step is asked all the same.
  if (user.twoFactorMethod === METHODS.EMAIL) {
    await sendEmailCode(pending, user).catch((error) =>
      logger.warn(`[two-factor] no code sent to ${user.id}: ${error.message}`)
    );
  }
  return { step: STEPS.VERIFY, method: user.twoFactorMethod };
}

module.exports = { stepAfterPassword };
