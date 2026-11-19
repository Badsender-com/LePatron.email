'use strict';

const ERROR_CODES = require('../constant/error-codes.js');
const {
  TWO_FACTOR_ACTIONS,
  TWO_FACTOR_METHODS,
} = require('../security-event/security-event.actions.js');

// Two-factor authentication (ADR 0008). Every limit is here, named.

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// Named with the security events, which record them.
const METHODS = TWO_FACTOR_METHODS;

// What the login answer asks after a right password.
const STEPS = Object.freeze({ VERIFY: 'verify', SETUP: 'setup' });

// What its security events record, with the other security events.
const SECURITY_ACTIONS = TWO_FACTOR_ACTIONS;

// The codes of the refusals, read by the login page.
const ERRORS = Object.freeze({
  STEP_EXPIRED: ERROR_CODES.TWO_FACTOR_STEP_EXPIRED,
  CODE_INCORRECT: ERROR_CODES.TWO_FACTOR_CODE_INCORRECT,
  METHOD_UNKNOWN: ERROR_CODES.TWO_FACTOR_METHOD_UNKNOWN,
  ALREADY_SET_UP: ERROR_CODES.TWO_FACTOR_ALREADY_SET_UP,
  TOO_MANY_CODES: ERROR_CODES.TWO_FACTOR_TOO_MANY_CODES,
});

module.exports = {
  METHODS,
  STEPS,
  SECURITY_ACTIONS,
  ERRORS,
  // The step after the password ends past this delay, or after this many
  // wrong codes: the member types their password again.
  PENDING_STEP_TTL_MS: 10 * MINUTE,
  MAX_WRONG_CODES: 5,
  RECOVERY_CODE_COUNT: 10,
  // Ten recovery codes are hashed at once and compared at once: a lower cost
  // than the password's keeps the sign-in quick, and 40 random bits stay out
  // of reach offline.
  RECOVERY_CODE_BCRYPT_ROUNDS: 8,
  // A code of the authenticator app is accepted one step (30 seconds)
  // either side of now: a phone's clock is rarely exact.
  TOTP_STEP_SECONDS: 30,
  TOTP_WINDOW_STEPS: 1,
  // 160 bits, as RFC 4226 recommends.
  TOTP_SECRET_BYTES: 20,
  TOTP_ISSUER: 'LePatron.email',
  TRUSTED_DEVICE_TTL_MS: 30 * DAY,
  TRUSTED_DEVICE_COOKIE: 'lp.trusted-device',
  // The browsers an account remembers at most; the oldest goes first.
  MAX_TRUSTED_DEVICES: 10,
  // Wrong passwords on an account since its last sign-in that make a sign-in
  // from a trusted device suspicious.
  SUSPICIOUS_WRONG_PASSWORDS: 5,
  EMAIL_CODE_TTL_MS: 10 * MINUTE,
  EMAIL_CODES_PER_STEP: 3,
  EMAIL_CODE_BCRYPT_ROUNDS: 8,
  EMAIL_CODES_PER_HOUR: 10,
  // The step of the code, rate limited apart from the password.
  CODE_ATTEMPTS_PER_HOUR_PER_ACCOUNT: 20,
};
