'use strict';

/**
 * Boolean fields sent through `multipart/form-data` reach the server as the
 * strings 'true' / 'false'. Mongoose 5 does cast those two itself, but only them
 * and a few others ('1', '0', 'yes', 'no'): anything else — an empty string, a
 * checkbox's 'on' — fails the cast at save time and surfaces as a raw error. This
 * turns every value into a real boolean before it reaches the document: 'true'
 * or true is true, anything else is false.
 *
 * Returns a shallow copy of `body` where each listed field, when present, is a
 * real boolean. Fields absent from `body` are left absent so a partial update
 * never resets them.
 *
 * @param {Object} body parsed multipart body
 * @param {string[]} fields field names to coerce
 * @returns {Object}
 */
function normalizeMultipartBooleans(body, fields) {
  if (!body || typeof body !== 'object') return body;
  const normalized = { ...body };
  fields.forEach((field) => {
    if (field in normalized) {
      normalized[field] =
        normalized[field] === true || normalized[field] === 'true';
    }
  });
  return normalized;
}

module.exports = { normalizeMultipartBooleans };
