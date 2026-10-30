'use strict';

const crypto = require('crypto');
const createError = require('http-errors');

const {
  PENDING_STEP_TTL_MS,
  MAX_WRONG_CODES,
  ERRORS,
} = require('./two-factor.constants.js');

// The step between a right password and the session (ADR 0008), kept in the
// session, which is not signed in yet: nothing that reads
// `req.isAuthenticated()` sees the account until the code is checked.
const KEY = 'twoFactorPending';

const expired = () => new createError.Unauthorized(ERRORS.STEP_EXPIRED);

// The password the step was started with, as a digest of its hash: a
// password changed meanwhile ends the step.
const passwordStampOf = (user) =>
  crypto
    .createHash('sha256')
    .update(String(user.password || ''))
    .digest('hex');

/**
 * @param {Object} req
 * @param {Object} user the account whose password was right
 * @param {string} step one of STEPS
 * @param {string} [method] the account's verification method
 * @returns {Object} the pending step
 */
function start(req, user, step, method) {
  req.session[KEY] = {
    userId: String(user.id),
    passwordStamp: passwordStampOf(user),
    step,
    method,
    expiresAt: Date.now() + PENDING_STEP_TTL_MS,
    wrongCodes: 0,
  };
  return req.session[KEY];
}

/**
 * The pending step, or a 401 when there is none, it expired, or it is not
 * `step`: the member types their password again.
 *
 * @param {Object} req
 * @param {string} [step]
 * @returns {Object}
 */
function read(req, step) {
  const pending = req.session && req.session[KEY];
  const valid =
    pending &&
    pending.expiresAt > Date.now() &&
    (!step || pending.step === step);
  if (!valid) {
    end(req);
    throw expired();
  }
  return pending;
}

/**
 * @param {Object} pending
 * @param {Object} user the account of the step, read again
 * @returns {boolean} whether its password is still the one of the step
 */
function isSamePassword(pending, user) {
  return pending.passwordStamp === passwordStampOf(user);
}

function end(req) {
  if (req.session) delete req.session[KEY];
}

/**
 * The id of the account of the pending step, for the rate limits; none
 * without one.
 *
 * @param {Object} req
 * @returns {string|undefined}
 */
function userIdOf(req) {
  return req.session && req.session[KEY] && req.session[KEY].userId;
}

/**
 * Counts a wrong code. Always throws: a 400 below the limit, a 401 that ends
 * the step once it is reached, after `onLimit` ran.
 *
 * @param {Object} req
 * @param {Object} pending
 * @param {Function} onLimit
 */
async function refuseCode(req, pending, onLimit) {
  pending.wrongCodes += 1;
  if (pending.wrongCodes < MAX_WRONG_CODES) {
    throw new createError.BadRequest(ERRORS.CODE_INCORRECT);
  }
  end(req);
  await onLimit();
  throw expired();
}

module.exports = {
  start,
  read,
  end,
  userIdOf,
  isSamePassword,
  refuseCode,
};
