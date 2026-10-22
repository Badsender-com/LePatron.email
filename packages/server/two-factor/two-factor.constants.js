'use strict';

// Two-factor authentication (ADR 0008). Every limit is here, named.

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const METHODS = Object.freeze({ TOTP: 'totp', EMAIL: 'email' });

// What the login answer asks after a right password.
const STEPS = Object.freeze({ VERIFY: 'verify', SETUP: 'setup' });

const SECURITY_ACTIONS = Object.freeze({
  RESET: 'two-factor.reset',
  REQUIRED: 'two-factor.required',
  NOT_REQUIRED: 'two-factor.not-required',
  SET_UP: 'two-factor.set-up',
  RECOVERY_CODE_USED: 'two-factor.recovery-code-used',
  DEVICE_TRUSTED: 'two-factor.device-trusted',
  WRONG_CODES: 'two-factor.wrong-codes',
});

// The messages of the refusals, read by the login page.
const ERRORS = Object.freeze({
  STEP_EXPIRED: 'two-factor.step-expired',
  CODE_INCORRECT: 'two-factor.code-incorrect',
  METHOD_UNKNOWN: 'two-factor.method-unknown',
  ALREADY_SET_UP: 'two-factor.already-set-up',
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
  // Wrong passwords on an account since its last sign-in that make a sign-in
  // from a trusted device suspicious.
  SUSPICIOUS_WRONG_PASSWORDS: 5,
  EMAIL_CODE_TTL_MS: 10 * MINUTE,
  EMAIL_CODES_PER_STEP: 3,
  EMAIL_CODES_PER_HOUR: 10,
  // The step of the code, rate limited apart from the password.
  CODE_ATTEMPTS_PER_HOUR_PER_ACCOUNT: 20,
  SECURITY_EVENT_TTL_SECONDS: 365 * 24 * 60 * 60,
};
