'use strict';

/**
 * What the user is told when an AI action's request fails, as a translation
 * key: by the code the server sends (`response.data.message`, from
 * packages/server/constant/error-codes.js), the HTTP status only when the code
 * is unknown. A 403 says the feature is off only when the server says so: a
 * refused capability, or an email the user may not write to, is another 403.
 */

// What the user can act on, by code of the text generation routes.
const KEYS_BY_CODE = {
  TEXT_GENERATION_DISABLED: 'text-generation-error-disabled',
  FORBIDDEN_CAPABILITY: 'text-generation-error-forbidden',
  FORBIDDEN_RESOURCE_OR_ACTION: 'text-generation-error-forbidden',
  AI_PAYLOAD_TOO_LARGE: 'text-generation-error-too-large',
  AI_RATE_LIMITED: 'text-generation-error-rate-limited',
  TEXT_GENERATION_FAILED: 'text-generation-error-failed',
  TEXT_GENERATION_UNAVAILABLE: 'text-generation-error-unavailable',
};

// When the code is missing or unknown.
const KEYS_BY_STATUS = {
  403: 'text-generation-error-forbidden',
  413: 'text-generation-error-too-large',
  429: 'text-generation-error-rate-limited',
  502: 'text-generation-error-failed',
  503: 'text-generation-error-unavailable',
};

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/**
 * @param {Object} err the rejection of the request (axios)
 * @returns {string} a translation key
 */
function errorKey(err) {
  const response = err && err.response;
  if (!response || !response.status) return 'text-generation-error-network';
  const code = response.data && response.data.message;
  if (typeof code === 'string' && own(KEYS_BY_CODE, code)) {
    return KEYS_BY_CODE[code];
  }
  if (own(KEYS_BY_STATUS, response.status)) {
    return KEYS_BY_STATUS[response.status];
  }
  return 'text-generation-error-failed';
}

module.exports = { errorKey };
