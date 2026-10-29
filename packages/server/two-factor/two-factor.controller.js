'use strict';

const createError = require('http-errors');
const asyncHandler = require('express-async-handler');

const logger = require('../utils/logger.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { Users } = require('../common/models.common.js');
const { encryptForStorage, decrypt } = require('../utils/crypto.js');
const { contextOf } = require('../utils/encryption-plugin.js');
const { UserModel } = require('../constant/model.names.js');
const { completeSignIn, endSessions } = require('../account/sign-in.js');
const userScope = require('../user/user-scope.js');
const superAdminPolicy = require('../user/super-admin-policy.js');
const rightsPolicy = require('../user/rights-policy.js');
const pendingStep = require('./pending-step.js');
const codes = require('./codes.js');
const { recordSecurityEvent } = require('./security-event.service.js');
const {
  sendTwoFactorEmail,
  deviceTrustedTexts,
} = require('./two-factor.emails.js');
const { trustDevice } = require('./trusted-device.js');
const { sendEmailCode, checkEmailCode } = require('./email-code.js');
const {
  METHODS,
  STEPS,
  ERRORS,
  SECURITY_ACTIONS,
} = require('./two-factor.constants.js');

// The methods a member may set up.
const SETUP_METHODS = [METHODS.TOTP, METHODS.EMAIL];

module.exports = {
  verify: asyncHandler(verify),
  startSetup: asyncHandler(startSetup),
  confirmSetup: asyncHandler(confirmSetup),
  sendEmailCode: asyncHandler(resendEmailCode),
  adminReset: asyncHandler(adminReset),
};

// The TOTP secret is bound to its account, as every stored secret
// (utils/crypto.js): one copied onto another account does not read.
const secretContextOf = (userId) =>
  contextOf(UserModel, userId, 'twoFactor.secret');

// A secret that does not read (altered, copied from another account) gives
// no code: the member signs in with a recovery code, or an admin resets it.
function readSecret(secret, userId) {
  if (!secret) return null;
  try {
    return decrypt(secret, secretContextOf(userId));
  } catch (error) {
    logger.error(`[two-factor] the secret of ${userId} does not decrypt`);
    return null;
  }
}

// The account of the pending step, with what checks its codes. The step
// ends when the account changed under it: deactivated, its password changed,
// or its setup reset while the member was typing the code.
async function pendingUser(req, pending) {
  const user = await Users.findById(pending.userId).select('+twoFactor');
  const stillValid =
    user &&
    !user.isDeactivated &&
    pendingStep.isSamePassword(pending, user) &&
    (pending.step !== STEPS.VERIFY || (user.twoFactorMethod && user.twoFactor));
  if (!stillValid) {
    pendingStep.end(req);
    throw new createError.Unauthorized(ERRORS.STEP_EXPIRED);
  }
  return user;
}

// Mongoose 5 answers `nModified`, later versions `modifiedCount`.
const changedOne = (result) =>
  (typeof result.nModified === 'number'
    ? result.nModified
    : result.modifiedCount) > 0;

// Single use, even when two requests race: the account changes only if the
// recovery code is still there, or the TOTP code later than the last one.
async function useRecoveryCode(user, match, stored) {
  const result = await Users.updateOne(
    { _id: user._id, 'twoFactor.recoveryCodes.hash': match.hash },
    { $set: { 'twoFactor.recoveryCodes': stored } }
  );
  return changedOne(result);
}

async function useTimeStep(user, timeStep) {
  const result = await Users.updateOne(
    {
      _id: user._id,
      $or: [
        { 'twoFactor.lastTimeStep': { $exists: false } },
        { 'twoFactor.lastTimeStep': { $lt: timeStep } },
      ],
    },
    { $set: { 'twoFactor.lastTimeStep': timeStep } }
  );
  return changedOne(result);
}

// Remembers the browser when the member asks, once the code is right.
function trustDeviceIfAsked(req, res, user) {
  return req.body.trustDevice === true ? trustDevice(user, req, res) : null;
}

async function notifyDeviceTrusted(user, device) {
  if (!device) return;
  await recordSecurityEvent({
    action: SECURITY_ACTIONS.DEVICE_TRUSTED,
    user: user.id,
  });
  await sendTwoFactorEmail(user, 'deviceTrusted', deviceTrustedTexts(device));
}

// The time step of a right TOTP code, `true` for a right emailed code, null
// for a wrong one.
async function checkCode(
  method,
  pending,
  { secret, userId },
  code,
  lastTimeStep
) {
  if (method === METHODS.EMAIL) {
    return (await checkEmailCode(pending, code)) ? true : null;
  }
  return codes.checkTotpCode(readSecret(secret, userId), code, lastTimeStep);
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
 * @apiParam (Body) {Boolean} [trustDevice] remember this browser 30 days
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
      user.twoFactor.recoveryCodes,
      recoveryCode
    );
    // A new set replaces them all, shown once: the used one is gone with it.
    const fresh = match && (await codes.newRecoveryCodes());
    if (!fresh || !(await useRecoveryCode(user, match, fresh.stored))) {
      await refuseCode(req, pending, user);
    }
    newRecoveryCodes = fresh.codes;
  } else {
    const { secret, lastTimeStep } = user.twoFactor;
    const checked = await checkCode(
      user.twoFactorMethod,
      pending,
      { secret, userId: user.id },
      code,
      lastTimeStep
    );
    // A TOTP code is used once in the account; an emailed one ends with the
    // step.
    const used = Number.isInteger(checked)
      ? await useTimeStep(user, checked)
      : checked === true;
    if (!used) await refuseCode(req, pending, user);
  }
  user.twoFactor.failedPasswords = 0;
  const device = trustDeviceIfAsked(req, res, user);
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
  await notifyDeviceTrusted(user, device);
  res.json(payload);
}

/**
 * @api {post} /account/login/two-factor/setup the start of the setup
 * @apiPermission public, after a right password, for an account with none
 * @apiName StartTwoFactorSetup
 * @apiGroup Account
 *
 * @apiParam (Body) {String} method `totp` or `email` (a code is sent)
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

  if (method === METHODS.EMAIL) {
    pending.setup = { method };
    await sendEmailCode(pending, user);
    return res.json({ method });
  }
  const { secret, uri, qrCode } = await codes.newTotpSecret(user.email);
  pending.setup = {
    method,
    secret: encryptForStorage(secret, secretContextOf(user.id)),
  };
  res.json({ method, secret, uri, qrCode });
}

/**
 * @api {post} /account/login/two-factor/setup/confirm the end of the setup
 * @apiPermission public, after the start of the setup
 * @apiName ConfirmTwoFactorSetup
 * @apiGroup Account
 *
 * @apiParam (Body) {String} code the first code of the method
 * @apiParam (Body) {Boolean} [trustDevice] remember this browser 30 days
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
  const checked = await checkCode(
    method,
    pending,
    { secret, userId: user.id },
    codes.normalizeCode(req.body.code)
  );
  if (checked === null) await refuseCode(req, pending, user);

  const recovery = await codes.newRecoveryCodes();
  user.twoFactorMethod = method;
  user.twoFactor = {
    secret,
    lastTimeStep: Number.isInteger(checked) ? checked : undefined,
    recoveryCodes: recovery.stored,
    trustedDevices: [],
    failedPasswords: 0,
  };
  const device = trustDeviceIfAsked(req, res, user);
  await user.save();
  pendingStep.end(req);
  await recordSecurityEvent({
    action: SECURITY_ACTIONS.SET_UP,
    user: user.id,
    method,
  });

  await sendTwoFactorEmail(user, 'setUp');

  const payload = await completeSignIn(req, user);
  payload.recoveryCodes = recovery.codes;
  await notifyDeviceTrusted(user, device);
  res.json(payload);
}

/**
 * @api {post} /account/login/two-factor/email-code a new code by email
 * @apiPermission public, after a right password, for the code by email
 * @apiName SendTwoFactorEmailCode
 * @apiDescription The new code replaces the previous one; at most three per
 *   sign-in and ten an hour per account.
 * @apiGroup Account
 */
async function resendEmailCode(req, res) {
  const pending = pendingStep.read(req);
  const method =
    pending.step === STEPS.SETUP
      ? pending.setup && pending.setup.method
      : pending.method;
  if (method !== METHODS.EMAIL) {
    throw new createError.BadRequest(ERRORS.METHOD_UNKNOWN);
  }
  const user = await pendingUser(req, pending);
  await sendEmailCode(pending, user);
  res.json({});
}

/**
 * @api {del} /users/:userId/two-factor two-factor reset
 * @apiPermission tech admin of the account's group, or super admin
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
  if (!user) throw new createError.NotFound(ERROR_CODES.USER_NOT_FOUND);
  // As the admin password reset: nobody resets an account whose
  // capabilities are not all their own (ADR 0004).
  userScope.assertActorReaches(req.user, user);
  superAdminPolicy.assertCanManage(req.user, user);
  rightsPolicy.assertCanManage(req.user, user);

  // Explicitly: the account was read without its `twoFactor`, so unsetting
  // it on the document would write nothing.
  await Users.updateOne(
    { _id: user._id },
    { $unset: { twoFactor: 1, twoFactorMethod: 1 } }
  );
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
