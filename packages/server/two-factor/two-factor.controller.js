'use strict';

const createError = require('http-errors');
const asyncHandler = require('express-async-handler');

const logger = require('../utils/logger.js');
const { Users } = require('../common/models.common.js');
const { encrypt, decrypt } = require('../utils/crypto.js');
const { completeSignIn, endSessions } = require('../account/sign-in.js');
const userScope = require('../user/user-scope.js');
const superAdminPolicy = require('../user/super-admin-policy.js');
const rightsPolicy = require('../user/rights-policy.js');
const pendingStep = require('./pending-step.js');
const codes = require('./codes.js');
const { recordSecurityEvent } = require('./security-event.service.js');
const { sendTwoFactorEmail } = require('./two-factor.emails.js');
const {
  METHODS,
  STEPS,
  ERRORS,
  SECURITY_ACTIONS,
} = require('./two-factor.constants.js');

// The methods a member may set up.
const SETUP_METHODS = [METHODS.TOTP];

module.exports = {
  verify: asyncHandler(verify),
  startSetup: asyncHandler(startSetup),
  confirmSetup: asyncHandler(confirmSetup),
  adminReset: asyncHandler(adminReset),
};

// The account of the pending step, with what checks its codes.
async function pendingUser(req, pending) {
  const user = await Users.findById(pending.userId).select('+twoFactor');
  if (!user || user.isDeactivated) {
    pendingStep.end(req);
    throw new createError.Unauthorized(ERRORS.STEP_EXPIRED);
  }
  return user;
}

function refuseCode(req, pending, user) {
  return pendingStep.refuseCode(req, pending, () =>
    recordSecurityEvent({ action: SECURITY_ACTIONS.WRONG_CODES, user: user.id })
  );
}

/**
 * @api {post} /account/login/two-factor the step of the code
 * @apiPermission public, after a right password
 * @apiName VerifyTwoFactor
 * @apiGroup Account
 *
 * @apiParam (Body) {String} code six digits, or a recovery code
 *
 * @apiUse users
 * @apiSuccess {String[]} [recoveryCodes] a new set, once one was used
 */
async function verify(req, res) {
  const pending = pendingStep.read(req, STEPS.VERIFY);
  const user = await pendingUser(req, pending);
  const code = codes.normalizeCode(req.body.code);
  const recoveryCode = codes.recoveryCodeOf(code);

  let newRecoveryCodes;
  if (recoveryCode) {
    const match = await codes.findRecoveryCode(
      user.twoFactor && user.twoFactor.recoveryCodes,
      recoveryCode
    );
    if (!match) await refuseCode(req, pending, user);
    // A new set replaces them all, shown once: the used one is gone with it.
    const fresh = await codes.newRecoveryCodes();
    user.twoFactor.recoveryCodes = fresh.stored;
    newRecoveryCodes = fresh.codes;
  } else {
    const secret = user.twoFactor && user.twoFactor.secret;
    const timeStep = codes.checkTotpCode(
      secret && decrypt(secret),
      code,
      user.twoFactor.lastTimeStep
    );
    if (timeStep === null) await refuseCode(req, pending, user);
    user.twoFactor.lastTimeStep = timeStep;
  }
  await user.save();
  pendingStep.end(req);

  const payload = await completeSignIn(req, user);
  if (newRecoveryCodes) {
    payload.recoveryCodes = newRecoveryCodes;
    await recordSecurityEvent({
      action: SECURITY_ACTIONS.RECOVERY_CODE_USED,
      user: user.id,
    });
    await sendTwoFactorEmail(user, 'recoveryCodeUsed');
  }
  res.json(payload);
}

/**
 * @api {post} /account/login/two-factor/setup the start of the setup
 * @apiPermission public, after a right password, for an account with none
 * @apiName StartTwoFactorSetup
 * @apiGroup Account
 *
 * @apiParam (Body) {String} method `totp`
 *
 * @apiSuccess {String} method
 * @apiSuccess {String} secret the TOTP secret, to type in the app by hand
 * @apiSuccess {String} uri its otpauth link
 * @apiSuccess {String} qrCode the link as a PNG data URL
 */
async function startSetup(req, res) {
  const pending = pendingStep.read(req);
  // The password alone never replaces a setup.
  if (pending.step !== STEPS.SETUP) {
    throw new createError.Conflict(ERRORS.ALREADY_SET_UP);
  }
  const { method } = req.body;
  if (!SETUP_METHODS.includes(method)) {
    throw new createError.BadRequest(ERRORS.METHOD_UNKNOWN);
  }
  const user = await pendingUser(req, pending);

  const { secret, uri, qrCode } = await codes.newTotpSecret(user.email);
  pending.setup = { method, secret: encrypt(secret) };
  res.json({ method, secret, uri, qrCode });
}

/**
 * @api {post} /account/login/two-factor/setup/confirm the end of the setup
 * @apiPermission public, after the start of the setup
 * @apiName ConfirmTwoFactorSetup
 * @apiGroup Account
 *
 * @apiParam (Body) {String} code the first code of the method
 *
 * @apiUse users
 * @apiSuccess {String[]} recoveryCodes the recovery codes, shown once
 */
async function confirmSetup(req, res) {
  const pending = pendingStep.read(req, STEPS.SETUP);
  if (!pending.setup) throw new createError.BadRequest(ERRORS.METHOD_UNKNOWN);
  const user = await pendingUser(req, pending);
  if (user.twoFactorMethod) {
    pendingStep.end(req);
    throw new createError.Conflict(ERRORS.ALREADY_SET_UP);
  }

  const { method, secret } = pending.setup;
  const timeStep = await codes.checkTotpCode(
    decrypt(secret),
    codes.normalizeCode(req.body.code)
  );
  if (timeStep === null) await refuseCode(req, pending, user);

  const recovery = await codes.newRecoveryCodes();
  user.twoFactorMethod = method;
  user.twoFactor = {
    secret,
    lastTimeStep: timeStep,
    recoveryCodes: recovery.stored,
    trustedDevices: [],
    failedPasswords: 0,
  };
  await user.save();
  pendingStep.end(req);
  await recordSecurityEvent({
    action: SECURITY_ACTIONS.SET_UP,
    user: user.id,
    method,
  });

  const payload = await completeSignIn(req, user);
  payload.recoveryCodes = recovery.codes;
  res.json(payload);
}

/**
 * @api {del} /users/:userId/two-factor two-factor reset
 * @apiPermission company admin of the account's group, or super admin
 * @apiName ResetTwoFactor
 * @apiDescription Erases the account's setup and trusted devices and ends its
 *   sessions; the member sets it up again at their next sign-in.
 * @apiGroup Users
 *
 * @apiParam {string} userId
 *
 * @apiUse users
 */
async function adminReset(req, res) {
  const { userId } = req.params;
  const user = await Users.findById(userId);
  if (!user) throw new createError.NotFound();
  // As the admin password reset: nobody resets an account whose
  // capabilities are not all their own (ADR 0004).
  userScope.assertActorReaches(req.user, user);
  superAdminPolicy.assertCanManage(req.user, user);
  rightsPolicy.assertCanManage(req.user, user);

  user.twoFactorMethod = undefined;
  user.twoFactor = undefined;
  await user.save();
  await endSessions(user.id);
  superAdminPolicy.logAction(req.user, 'reset-two-factor', user);
  logger.info(`[two-factor] reset for ${user.id}`);
  await recordSecurityEvent({
    action: SECURITY_ACTIONS.RESET,
    user: user.id,
    actor: req.user.id,
  });
  await sendTwoFactorEmail(user, 'reset');

  res.json(await Users.findOneForApi({ _id: userId }));
}
