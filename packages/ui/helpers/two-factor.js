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
