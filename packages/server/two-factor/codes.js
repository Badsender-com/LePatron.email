'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { authenticator } = require('otplib');

const {
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_BCRYPT_ROUNDS,
  TOTP_WINDOW_STEPS,
  TOTP_SECRET_BYTES,
  TOTP_STEP_SECONDS,
  TOTP_ISSUER,
} = require('./two-factor.constants.js');

// The codes a member types after their password (ADR 0008): six digits from
// their authenticator app or their email, or a recovery code.

const SIX_DIGITS = /^\d{6}$/;
const RECOVERY_CODE = /^([A-Z0-9]{4})-?([A-Z0-9]{4})$/;
// No 0, O, 1 or I: a recovery code is often copied by hand.
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * What the member typed, without spaces, in capitals.
 *
 * @param {*} input
 * @returns {string}
 */
function normalizeCode(input) {
  return String(input == null ? '' : input)
    .replace(/\s+/g, '')
    .toUpperCase();
}

const isSixDigits = (code) => SIX_DIGITS.test(code);

/**
 * @param {string} code normalized
 * @returns {string|null} the recovery code as given, `XXXX-XXXX`, or null
 */
function recoveryCodeOf(code) {
  const match = RECOVERY_CODE.exec(code);
  return match ? `${match[1]}-${match[2]}` : null;
}

// A copy of the library's authenticator for one check: its options are a
// shared object, and the clock is the request's.
const totpAt = (epoch) =>
  authenticator.clone({
    step: TOTP_STEP_SECONDS,
    window: TOTP_WINDOW_STEPS,
    epoch,
  });

/**
 * A new secret for the authenticator app, with what the setup shows of it.
 *
 * @param {string} label the account's email
 * @returns {Promise<{secret: string, uri: string, qrCode: string}>}
 */
async function newTotpSecret(label) {
  const secret = authenticator.generateSecret(TOTP_SECRET_BYTES);
  const uri = authenticator.keyuri(label, TOTP_ISSUER, secret);
  const qrCode = await QRCode.toDataURL(uri);
  return { secret, uri, qrCode };
}

/**
 * @param {string} secret the TOTP secret, in clear
 * @param {string} code six digits
 * @param {number} [lastTimeStep] the step of the last code accepted
 * @returns {number|null} the time step of the code, null when it is wrong,
 *   out of the window, or not later than the last one accepted
 */
function checkTotpCode(secret, code, lastTimeStep) {
  if (!secret || !isSixDigits(code)) return null;
  const now = Date.now();
  const delta = totpAt(now).checkDelta(code, secret);
  if (delta === null) return null;
  const timeStep = Math.floor(now / 1000 / TOTP_STEP_SECONDS) + delta;
  if (Number.isInteger(lastTimeStep) && timeStep <= lastTimeStep) return null;
  return timeStep;
}

function newRecoveryCode() {
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += RECOVERY_ALPHABET[crypto.randomInt(RECOVERY_ALPHABET.length)];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * A new set of recovery codes: in clear to show once, hashed to store.
 *
 * @returns {Promise<{codes: string[], stored: Object[]}>}
 */
async function newRecoveryCodes() {
  const codes = new Set();
  while (codes.size < RECOVERY_CODE_COUNT) codes.add(newRecoveryCode());
  const list = [...codes];
  const stored = await Promise.all(
    list.map(async (code) => ({
      hash: await bcrypt.hash(code, RECOVERY_CODE_BCRYPT_ROUNDS),
    }))
  );
  return { codes: list, stored };
}

/**
 * @param {Object[]} stored the account's recovery codes
 * @param {string} code `XXXX-XXXX`
 * @returns {Promise<Object|null>} the stored code it matches
 */
async function findRecoveryCode(stored, code) {
  const entries = stored || [];
  const matches = await Promise.all(
    entries.map((entry) => bcrypt.compare(code, entry.hash))
  );
  const index = matches.indexOf(true);
  return index === -1 ? null : entries[index];
}

module.exports = {
  normalizeCode,
  isSixDigits,
  recoveryCodeOf,
  newTotpSecret,
  checkTotpCode,
  newRecoveryCodes,
  findRecoveryCode,
};
