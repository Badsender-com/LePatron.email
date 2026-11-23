'use strict';

/**
 * What one request of the spelling correction holds (ADR 0011): a block's
 * fields, each a few lines of an email, not a document. The server refuses a
 * larger request; the editor splits a block's fields into requests within
 * them. The AI rate limit caps the requests themselves.
 */
module.exports = {
  MAX_FIELDS: 40,
  MAX_FIELD_LENGTH: 5000,
  MAX_TOTAL_LENGTH: 50000,
};
