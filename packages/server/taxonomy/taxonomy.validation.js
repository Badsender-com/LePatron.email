'use strict';

const { BadRequest } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');
const {
  TaxonomyTypeValues,
  TaxonomyLimits,
} = require('../constant/taxonomy-type.js');

// `ObjectId.isValid` returns true for ANY 12-character string, reinterpreting its
// bytes as an id: 'companyAdmin' becomes a perfectly valid ObjectId pointing at a
// company that does not exist. Only a 24-char hex string is a real id.
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const isObjectId = (value) => OBJECT_ID_PATTERN.test(String(value));

// The fields a payload may carry. Anything else is refused rather than dropped: a
// typo like `cannonicalType` would otherwise answer 200 and change nothing, which
// reads as "saved" to the admin.
const EDITABLE_FIELDS = Object.freeze([
  'label',
  'description',
  'canonicalType',
  'isActive',
  'order',
]);

module.exports = {
  isObjectId,
  validateType,
  validatePayload,
  EDITABLE_FIELDS,
};

function validateType(type) {
  if (!type || !TaxonomyTypeValues.includes(type)) {
    throw new BadRequest(ERROR_CODES.INVALID_TAXONOMY_TYPE);
  }
  return type;
}

const invalid = () => new BadRequest(ERROR_CODES.INVALID_TAXONOMY_ITEM);

/**
 * Validate the editable fields. On a partial update only the keys present are
 * returned, so a PATCH never clears a field it did not mention.
 *
 * One reader per field rather than one long branch: each answers for its own
 * field, and the orchestration below stays readable as fields are added.
 *
 * @param {Object} payload
 * @param {Object} options
 * @param {boolean} options.partial
 * @returns {Object} the fields to assign
 */
function validatePayload(payload, { partial }) {
  assertNoUnknownKey(payload);

  const fields = {};
  const hasLabel = payload.label !== undefined;

  if (!partial && !hasLabel) {
    throw new BadRequest(ERROR_CODES.MISSING_TAXONOMY_ITEM_LABEL);
  }

  // Assigned rather than conditionally spread: a reader returning `undefined`
  // means "clear it", and the key must exist for Object.assign to unset the path
  // and for the emptiness check below to count it.
  if (hasLabel) fields.label = readLabel(payload.label);
  if (payload.description !== undefined) {
    fields.description = readDescription(payload.description);
  }
  if (payload.canonicalType !== undefined) {
    fields.canonicalType = readCanonicalType(payload.canonicalType);
  }
  if (payload.isActive !== undefined) {
    fields.isActive = readIsActive(payload.isActive);
  }
  if (payload.order !== undefined) fields.order = readOrder(payload.order);

  // A PATCH carrying nothing usable would answer 200 without changing anything,
  // which reads as a successful save.
  if (partial && Object.keys(fields).length === 0) {
    throw invalid();
  }

  return fields;
}

function assertNoUnknownKey(payload) {
  // Own enumerable keys only, so a `__proto__` coming out of JSON.parse is looked
  // at like any other unknown key and refused.
  const unknownKeys = Object.keys(payload).filter(
    (key) => !EDITABLE_FIELDS.includes(key)
  );
  if (unknownKeys.length > 0) {
    throw invalid();
  }
}

function readLabel(value) {
  if (typeof value !== 'string') throw invalid();
  const label = value.trim();
  if (label === '') {
    throw new BadRequest(ERROR_CODES.MISSING_TAXONOMY_ITEM_LABEL);
  }
  if (label.length > TaxonomyLimits.LABEL) throw invalid();
  return label;
}

/**
 * @returns {string|undefined} undefined clears the stored value — same rule as
 *   readCanonicalType, because two neighbouring optional fields must not answer
 *   differently to the same input.
 */
function readDescription(value) {
  if (value === null || value === '') return undefined;
  if (typeof value !== 'string') throw invalid();
  if (value.length > TaxonomyLimits.DESCRIPTION) throw invalid();
  return value;
}

/**
 * @returns {string|undefined} undefined clears the mapping onto the AI skills
 *   vocabulary, which is optional — clearing it is a legitimate choice.
 */
function readCanonicalType(value) {
  if (value === null || value === '') return undefined;
  if (typeof value !== 'string') throw invalid();
  const canonicalType = value.trim();
  if (canonicalType.length > TaxonomyLimits.CANONICAL_TYPE) throw invalid();
  // Deliberately not checked against the canonical list: that list evolves with
  // the AI skills, which already accept a free value and fall back on the raw
  // string. See constant/email-type-canonical.js.
  return canonicalType;
}

function readIsActive(value) {
  if (typeof value !== 'boolean') throw invalid();
  return value;
}

function readOrder(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid();
  return value;
}
