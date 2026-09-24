'use strict';

const { BadRequest } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');

module.exports = {
  normalizeProductId,
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
