'use strict';

/**
 * Boolean fields sent through `multipart/form-data` reach the server as the
 * strings 'true' / 'false'. Mongoose casts the *string* 'false' to `true`
 * (any non-empty string is truthy for its Boolean caster), so a switch turned
 * off in the UI would silently turn back on after a save.
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
