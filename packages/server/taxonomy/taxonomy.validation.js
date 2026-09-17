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

/**
 * Validate the editable fields. On a partial update only the keys present are
 * returned, so a PATCH never clears a field it did not mention.
 *
 * @param {Object} payload
 * @param {Object} options
 * @param {boolean} options.partial
 * @returns {Object} the fields to assign
 */
function validatePayload(payload, { partial }) {
  const fields = {};
  const invalid = () => new BadRequest(ERROR_CODES.INVALID_TAXONOMY_ITEM);

  // Own enumerable keys only, so a `__proto__` coming out of JSON.parse is looked
  // at like any other unknown key and refused.
  const unknownKeys = Object.keys(payload).filter(
    (key) => !EDITABLE_FIELDS.includes(key)
  );
  if (unknownKeys.length > 0) {
    throw invalid();
  }

  const hasLabel = payload.label !== undefined;

  if (!partial && !hasLabel) {
    throw new BadRequest(ERROR_CODES.MISSING_TAXONOMY_ITEM_LABEL);
  }

  if (hasLabel) {
    if (typeof payload.label !== 'string') throw invalid();
    const label = payload.label.trim();
    if (label === '') {
      throw new BadRequest(ERROR_CODES.MISSING_TAXONOMY_ITEM_LABEL);
    }
    if (label.length > TaxonomyLimits.LABEL) throw invalid();
    fields.label = label;
  }

  if (payload.description !== undefined) {
    // Same rule as canonicalType below: an emptied field clears the value rather
    // than storing a blank. Two neighbouring optional fields must not answer
    // differently to the same input.
    if (payload.description === null || payload.description === '') {
      fields.description = undefined;
    } else {
      if (typeof payload.description !== 'string') throw invalid();
      if (payload.description.length > TaxonomyLimits.DESCRIPTION) {
        throw invalid();
      }
      fields.description = payload.description;
    }
  }

  if (payload.canonicalType !== undefined) {
    if (payload.canonicalType === null || payload.canonicalType === '') {
      // The mapping onto the AI skills vocabulary is optional; clearing it is a
      // legitimate choice, not an error.
      fields.canonicalType = undefined;
    } else {
      if (typeof payload.canonicalType !== 'string') throw invalid();
      const canonicalType = payload.canonicalType.trim();
      if (canonicalType.length > TaxonomyLimits.CANONICAL_TYPE) throw invalid();
      // Deliberately not checked against the canonical list: that list evolves
      // with the AI skills, which already accept a free value and fall back on
      // the raw string. See constant/email-type-canonical.js.
      fields.canonicalType = canonicalType;
    }
  }

  if (payload.isActive !== undefined) {
    if (typeof payload.isActive !== 'boolean') throw invalid();
    fields.isActive = payload.isActive;
  }

  if (payload.order !== undefined) {
    if (typeof payload.order !== 'number' || !Number.isFinite(payload.order)) {
      throw invalid();
    }
    fields.order = payload.order;
  }

  // A PATCH carrying nothing usable would answer 200 without changing anything,
  // which reads as a successful save.
  if (partial && Object.keys(fields).length === 0) {
    throw invalid();
  }

  return fields;
}
