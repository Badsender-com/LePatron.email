// The sign-in after the password, with two-factor authentication (ADR 0008).

import { ERROR_CODES } from '~/helpers/constants/error-codes.js';

export const STEP_VERIFY = 'verify';
export const STEP_SETUP = 'setup';
export const STEP_RECOVERY_CODES = 'recovery-codes';
export const STEP_SIGNED_IN = 'signed-in';

/**
 * What the login page shows after an answer of the sign-in: the code, the
 * setup, the new recovery codes, or nothing, the member being signed in.
 *
 * @param {Object} answer the server's
 * @returns {string} one of the steps above
 */
export function signInStepOf(answer) {
  if (answer && answer.twoFactor) return answer.twoFactor.step;
  if (answer && Array.isArray(answer.recoveryCodes)) {
    return STEP_RECOVERY_CODES;
  }
  return STEP_SIGNED_IN;
}

/**
 * Whether a refusal ended the step: the member types their password again.
 *
 * @param {Error} error an axios error
 * @returns {boolean}
 */
export function isStepExpired(error) {
  return error?.response?.status === 401;
}

/**
 * The i18n key of a refusal of the step of the code.
 *
 * @param {Error} error an axios error
 * @returns {string}
 */
export function twoFactorErrorKey(error) {
  const status = error?.response?.status;
  if (status === 401) return 'twoFactor.code.expired';
  if (status === 429) return 'global.errors.tooManyRequests';
  if (
    error?.response?.data?.message === ERROR_CODES.TWO_FACTOR_CODE_INCORRECT
  ) {
    return 'twoFactor.code.incorrect';
  }
  return 'global.errors.errorOccured';
}

/**
 * The address a code was sent to, masked: its first letter and its domain.
 *
 * @param {string} email the address typed at the first step
 * @returns {string} `c•••@exemple.fr`, or '' without an address
 */
export function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!local || !domain) return '';
  return `${local[0]}•••@${domain}`;
}

/**
 * The key of an authenticator app, in groups of four to be read and typed.
 *
 * @param {string} secret the base32 key the setup answered
 * @returns {string}
 */
export function groupKey(secret) {
  return (String(secret || '').match(/.{1,4}/g) || []).join(' ');
}

/**
 * Two letters for whoever signs in: the words of their address before the @.
 *
 * @param {string} email
 * @returns {string}
 */
export function initialsOfEmail(email) {
  const local = String(email || '').split('@')[0];
  const words = local.split(/[._\-+\s]+/).filter(Boolean);
  if (!words.length) return '?';
  const letters =
    words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
  return letters.toUpperCase();
}
