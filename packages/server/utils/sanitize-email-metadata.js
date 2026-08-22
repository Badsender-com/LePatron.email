'use strict';

const { UnprocessableEntity } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');

/**
 * Fields a company may declare as mandatory.
 *
 * `preheader` is deliberately absent: it is a template property, not a mailing
 * field, and it is not part of the metadata this phase edits. Declaring it
 * mandatory would name a field nothing collects.
 */
const EMAIL_METADATA_FIELDS = Object.freeze([
  'subject',
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
 * Throws an UnprocessableEntity carrying ERROR_CODES.INVALID_EMAIL_METADATA — the
 * same code and status as the mailing-side validation, so the front has a single
 * case to handle. The human-readable reason travels in `.details`.
 *
 * @param {Object} raw the req.body emailMetadata payload
 * @returns {{ enabled: boolean, requiredFields: string[] }}
 */
function sanitizeEmailMetadata(raw) {
  const fail = (details) => {
    const err = new UnprocessableEntity(ERROR_CODES.INVALID_EMAIL_METADATA);
    err.details = details;
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
    // The offending value is deliberately not echoed back: the list of allowed
    // names is more useful to the caller, and nothing user-supplied travels back
    // out through an error message.
    if (!EMAIL_METADATA_FIELDS.includes(name)) {
      throw fail(
        `emailMetadata.requiredFields[${i}] is not a known field. Allowed: ${EMAIL_METADATA_FIELDS.join(
          ', '
        )}`
      );
    }
    if (seen.has(name)) {
      throw fail(`emailMetadata.requiredFields[${i}] is a duplicate`);
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
