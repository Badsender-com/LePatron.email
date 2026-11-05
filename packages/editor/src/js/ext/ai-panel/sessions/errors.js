'use strict';

// What the user can act on, by status of the text generation routes.
const ERROR_KEYS = {
  401: 'text-generation-error-signed-out',
  // Refused for the user or the email; the feature off has its own code.
  403: 'text-generation-error-forbidden',
  413: 'text-generation-error-too-large',
  429: 'text-generation-error-rate-limited',
  502: 'text-generation-error-failed',
  503: 'text-generation-error-unavailable',
};

/** The message key of a failed request, by its status. */
function errorKey(err) {
  const status = err && err.response && err.response.status;
  if (!status) return 'text-generation-error-network';
  const code = err.response.data && err.response.data.message;
  if (status === 403 && code === 'TEXT_GENERATION_DISABLED') {
    return 'text-generation-error-disabled';
  }
  return ERROR_KEYS[status] || 'text-generation-error-failed';
}

module.exports = { errorKey };
