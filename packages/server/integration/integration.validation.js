'use strict';

const { BadRequest } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');

module.exports = {
  normalizeProductId,
  assertApiKeyResent,
};

// Infomaniak builds its base URL from productId (`/1/ai/{productId}/openai`),
// so anything but its numeric id reshapes the path the API key is sent to:
// `../../2/profile?x=` reaches another endpoint of api.infomaniak.com.
const PRODUCT_ID_PATTERN = /^\d{1,20}$/;

/**
 * Trim and validate a productId. Empty means "none": null, so that clearing
 * the field clears the value instead of storing ''.
 */
function normalizeProductId(productId) {
  if (productId === undefined || productId === null) return productId;
  const trimmed = String(productId).trim();
  if (trimmed === '') return null;
  if (!PRODUCT_ID_PATTERN.test(trimmed)) {
    throw new BadRequest(ERROR_CODES.INVALID_PRODUCT_ID);
  }
  return trimmed;
}

const sameHost = (a, b) => (a || null) === (b || null);

/**
 * Refuse to point a stored key at a new destination without the key itself.
 *
 * The stored key is decrypted and sent with every call, to whatever host the
 * integration names. Letting an update change the host or the provider alone
 * meant any admin of the group could send a key someone else entered — one
 * they cannot read on screen — to a server of their own. Asking for the key
 * again closes that: whoever redirects it must already know it.
 *
 * Only when a key is stored: without one (a public RSS feed) there is nothing
 * to send.
 */
function assertApiKeyResent({ integration, provider, apiHost, apiKey }) {
  if (!integration.apiKey || apiKey) return;

  const providerChanged =
    provider !== undefined && provider !== integration.provider;
  const hostChanged =
    apiHost !== undefined && !sameHost(apiHost, integration.apiHost);

  if (providerChanged || hostChanged) {
    throw new BadRequest(ERROR_CODES.INTEGRATION_API_KEY_REQUIRED);
  }
}
