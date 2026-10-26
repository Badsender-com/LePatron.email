'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const createError = require('http-errors');

const { isSixDigits } = require('./codes.js');
const { sendTwoFactorEmail } = require('./two-factor.emails.js');
const {
  EMAIL_CODE_TTL_MS,
  EMAIL_CODES_PER_STEP,
  EMAIL_CODES_PER_HOUR,
  EMAIL_CODE_BCRYPT_ROUNDS,
  ERRORS,
} = require('./two-factor.constants.js');

// The code by email (ADR 0008): six digits, valid ten minutes and once, kept
// hashed in the pending step. Only the last one sent works.

const HOUR = 60 * 60 * 1000;
// Bounded, like the rate limiter of utils/rate-limit.js: in memory and per
// process, the oldest window dropped first.
const MAX_ACCOUNTS = 10000;
const hourlyBudgets = new Map();

function takeHourlyBudget(userId) {
  const now = Date.now();
  let budget = hourlyBudgets.get(userId);
  if (!budget || budget.resetAt <= now) {
    hourlyBudgets.delete(userId);
    if (hourlyBudgets.size >= MAX_ACCOUNTS) {
      hourlyBudgets.delete(hourlyBudgets.keys().next().value);
    }
    budget = { count: 0, resetAt: now + HOUR };
    hourlyBudgets.set(userId, budget);
  }
  if (budget.count >= EMAIL_CODES_PER_HOUR) return false;
  budget.count += 1;
  return true;
}

const TEXTS = {
  fr: {
    title: 'Votre code de vérification : {code}',
    desc:
      'Il est valable 10 minutes. Si vous n’êtes pas en train de vous connecter, ignorez cet email et prévenez l’administrateur de votre groupe : quelqu’un connaît votre mot de passe.',
    reset: 'SE CONNECTER',
  },
  en: {
    title: 'Your verification code: {code}',
    desc:
      'It is valid for 10 minutes. If you are not signing in, ignore this email and tell the administrator of your group: someone knows your password.',
    reset: 'SIGN IN',
  },
};

function textsWith(code) {
  const texts = {};
  Object.entries(TEXTS).forEach(([lang, text]) => {
    texts[lang] = { ...text, title: text.title.replace('{code}', code) };
  });
  return texts;
}

/**
 * Sends a new code to the account's address, which replaces the previous
 * one. At most three per pending step and ten an hour per account: a 429
 * past either.
 *
 * @param {Object} pending the pending step
 * @param {Object} user the account
 * @returns {Promise<void>}
 */
async function sendEmailCode(pending, user) {
  if ((pending.emailCodesSent || 0) >= EMAIL_CODES_PER_STEP) {
    throw new createError.TooManyRequests(ERRORS.TOO_MANY_CODES);
  }
  if (!takeHourlyBudget(String(user.id))) {
    throw new createError.TooManyRequests(ERRORS.TOO_MANY_CODES);
  }
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  pending.emailCodesSent = (pending.emailCodesSent || 0) + 1;
  pending.emailCode = {
    hash: await bcrypt.hash(code, EMAIL_CODE_BCRYPT_ROUNDS),
    expiresAt: Date.now() + EMAIL_CODE_TTL_MS,
  };
  await sendTwoFactorEmail(user, 'emailCode', textsWith(code));
}

/**
 * @param {Object} pending the pending step
 * @param {string} code normalized
 * @returns {Promise<boolean>} whether it is the last code sent, in time
 */
async function checkEmailCode(pending, code) {
  const sent = pending.emailCode;
  if (!sent || sent.expiresAt <= Date.now() || !isSixDigits(code)) {
    return false;
  }
  return bcrypt.compare(code, sent.hash);
}

module.exports = { sendEmailCode, checkEmailCode };
