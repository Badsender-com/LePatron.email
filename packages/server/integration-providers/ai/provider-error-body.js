'use strict';

/**
 * Reading what a provider says when it refuses a call.
 *
 * Split out of BaseLLMProvider: every dialect's error ends up here, and the
 * masking is the part that must not be skipped — the message is logged,
 * persisted on skill invocations and shown to the user.
 */

const MAX_MESSAGE_LENGTH = 300;

/**
 * Truncate, and mask anything shaped like a key or token (long alphanumeric
 * runs). An upstream 401 body can echo part of the key, and a self-hosted
 * gateway can echo far more.
 */
function sanitizeProviderMessage(message) {
  if (!message) return 'Unknown error';
  const str = String(message);
  const truncated =
    str.length > MAX_MESSAGE_LENGTH
      ? str.substring(0, MAX_MESSAGE_LENGTH) + '...'
      : str;
  return truncated.replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[REDACTED]');
}

/**
 * @param {Response} response a non-2xx provider response
 * @returns {Promise<{ parsedError: Object|null, message: string }>} the parsed
 *   body when it is JSON (dialects read their own error codes from it), and
 *   the sanitised message
 */
async function readProviderError(response) {
  const errorText = await response.text().catch(() => '');
  let parsedError = null;
  let message;
  try {
    parsedError = JSON.parse(errorText);
    message =
      (parsedError.error && parsedError.error.message) ||
      parsedError.message ||
      (parsedError.result && parsedError.result.message);
  } catch {
    message = errorText;
  }
  return { parsedError, message: sanitizeProviderMessage(message) };
}

module.exports = { readProviderError, sanitizeProviderMessage };
