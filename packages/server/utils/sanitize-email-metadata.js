'use strict';

/**
 * Fields a company may declare as mandatory. `preheader` is in the list even
 * though it is not a mailing field: it is edited through the same panel, and
 * stored in the template's own `data` (see mailing/preheader-resolver.js).
 */
const EMAIL_METADATA_FIELDS = Object.freeze([
  'subject',
  'preheader',
  'plannedSendDate',
  'emailType',
]);

/**
 * Validate and normalize an `emailMetadata` payload before it is persisted on a
 * company. Same contract as sanitizeTrackingConfig: the UI enforces these rules
 * but the UI is bypassable, so the server guarantees the shape.
 *
 * Unknown fields are stripped rather than stored, and `requiredFields` is
 * restricted to the known field names — an unknown entry would silently never be
 * enforced, which is worse than a clear rejection.
 *
 * Throws an Error with `.code = INVALID_EMAIL_METADATA` and `.statusCode = 422`.
 *
 * @param {Object} raw the req.body emailMetadata payload
 * @returns {{ enabled: boolean, requiredFields: string[] }}
 */
function sanitizeEmailMetadata(raw) {
  const fail = (message) => {
    const err = new Error(message);
    err.code = 'INVALID_EMAIL_METADATA';
    err.statusCode = 422;
    return err;
  };

  const cfg = raw && typeof raw === 'object' ? raw : {};

  if (cfg.requiredFields != null && !Array.isArray(cfg.requiredFields)) {
    throw fail('emailMetadata.requiredFields must be an array');
  }

  const seen = new Set();
  const requiredFields = (cfg.requiredFields || []).map((field, i) => {
    if (typeof field !== 'string') {
      throw fail(`emailMetadata.requiredFields[${i}] must be a string`);
    }
    const name = field.trim();
    if (!EMAIL_METADATA_FIELDS.includes(name)) {
      throw fail(
        `emailMetadata.requiredFields[${i}] is not a known field: ${name}`
      );
    }
    if (seen.has(name)) {
      throw fail(`emailMetadata.requiredFields has a duplicate: ${name}`);
    }
    seen.add(name);
    return name;
  });

  return {
    enabled: Boolean(cfg.enabled),
    requiredFields,
  };
}

module.exports = { sanitizeEmailMetadata, EMAIL_METADATA_FIELDS };
