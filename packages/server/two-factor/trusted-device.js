'use strict';

const crypto = require('crypto');
const UAParser = require('ua-parser-js');

const config = require('../node.config.js');
const { Users } = require('../common/models.common.js');
const {
  TRUSTED_DEVICE_TTL_MS,
  TRUSTED_DEVICE_COOKIE,
  SUSPICIOUS_WRONG_PASSWORDS,
  MAX_TRUSTED_DEVICES,
} = require('./two-factor.constants.js');

// A browser a member chose to remember (ADR 0008): it skips the code for
// thirty days, never the password, unless the sign-in is suspicious. The
// cookie holds a random token, the account only its hash.

const hashOf = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

/**
 * The browser and the OS of a request, by name only: a browser that updates
 * itself stays the same device.
 *
 * @param {Object} req
 * @returns {{browser: string, os: string}}
 */
function deviceOf(req) {
  const parser = new UAParser(req.get('user-agent') || '');
  return {
    browser: parser.getBrowser().name || 'unknown',
    os: parser.getOS().name || 'unknown',
  };
}

/**
 * Whether the sign-in comes from a device the account trusts, and is not
 * suspicious: the same browser and OS as when it was trusted, within thirty
 * days, and fewer than five wrong passwords since the last sign-in.
 *
 * @param {Object} user the account, with its `twoFactor`
 * @param {Object} req
 * @returns {boolean}
 */
function isTrustedDevice(user, req) {
  const token = req.cookies && req.cookies[TRUSTED_DEVICE_COOKIE];
  const twoFactor = user.twoFactor;
  if (!token || !twoFactor) return false;
  if ((twoFactor.failedPasswords || 0) >= SUSPICIOUS_WRONG_PASSWORDS) {
    return false;
  }
  const tokenHash = hashOf(token);
  const { browser, os } = deviceOf(req);
  return (twoFactor.trustedDevices || []).some(
    (device) =>
      device.tokenHash === tokenHash &&
      new Date(device.expiresAt).getTime() > Date.now() &&
      device.browser === browser &&
      device.os === os
  );
}

/**
 * Remembers the browser of `req` on the account and gives it its cookie.
 * The account is saved by the caller.
 *
 * @param {Object} user the account, with its `twoFactor`
 * @param {Object} req
 * @param {Object} res
 * @returns {{browser: string, os: string}} the device trusted
 */
function trustDevice(user, req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  const device = {
    tokenHash: hashOf(token),
    expiresAt: new Date(Date.now() + TRUSTED_DEVICE_TTL_MS),
    ...deviceOf(req),
  };
  // The expired ones go, and the oldest past the limit.
  const kept = (user.twoFactor.trustedDevices || []).filter(
    (known) => new Date(known.expiresAt).getTime() > Date.now()
  );
  user.twoFactor.trustedDevices = [...kept, device].slice(-MAX_TRUSTED_DEVICES);
  res.cookie(TRUSTED_DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !config.isDev,
    maxAge: TRUSTED_DEVICE_TTL_MS,
    path: '/',
  });
  return { browser: device.browser, os: device.os };
}

/**
 * Forgets every device the account trusts: on a password change and a
 * deactivation (a two-factor reset erases them with the rest).
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function forgetTrustedDevices(userId) {
  await Users.updateOne(
    { _id: userId },
    { $set: { 'twoFactor.trustedDevices': [] } }
  );
}

module.exports = { isTrustedDevice, trustDevice, forgetTrustedDevices };
