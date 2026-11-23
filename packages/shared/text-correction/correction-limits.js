'use strict';

/**
 * What one request of the spelling correction may carry (ADR 0011): the route
 * refuses more, and the editor splits its requests to stay within. One
 * declaration for both, so they never disagree. A few lines of an email per
 * field: these keep a request to a few blocks, not a document; the AI rate
 * limit caps the requests themselves.
 */
const MAX_FIELDS = 40;
const MAX_FIELD_LENGTH = 5000;
const MAX_TOTAL_LENGTH = 50000;
// A field's path in its block (`image.alt`), a block's id and its type.
const MAX_PATH_LENGTH = 200;
const MAX_BLOCK_ID_LENGTH = 100;

// What a field weighs in a request: its text, and what names it.
const sentLength = (field) =>
  field.text.length + field.path.length + (field.blockId || '').length;

module.exports = {
  MAX_FIELDS,
  MAX_FIELD_LENGTH,
  MAX_TOTAL_LENGTH,
  MAX_PATH_LENGTH,
  MAX_BLOCK_ID_LENGTH,
  sentLength,
};
