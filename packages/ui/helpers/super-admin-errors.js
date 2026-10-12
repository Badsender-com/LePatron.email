// Turn a refusal of the super admin guardrails (ADR 0002) into a sentence
// in the user's language.
//
// The server sends identifiers, not prose: the error's `message` is an
// ERROR_CODES entry. The wording lives in the locales, under
// `superAdmins.errors.*`. `vm` is the component instance (for $t).

import { ERROR_CODES } from '~/helpers/constants/error-codes.js';

/**
 * @param {Object} vm component instance
 * @param {Error} err an axios error
 * @returns {string} the translated refusal, or the generic fallback when the
 *   error is not one of the super admin guardrails
 */
export function superAdminErrorMessage(vm, err) {
  const code =
    err && err.response && err.response.data && err.response.data.message;
  const key = `superAdmins.errors.${code}`;
  if (code && ERROR_CODES[code] === code && vm.$te(key)) return vm.$t(key);
  return vm.$t('global.errors.errorOccured');
}
