'use strict';

const { BadRequest, Conflict } = require('http-errors');

const ERROR_CODES = require('../../constant/error-codes.js');
const {
  TaxonomyLimits,
  DIMENSION_NAME_PATTERN,
} = require('../../constant/taxonomy-type.js');

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
  // The availability: the parent values a value is offered under.
  'parentIds',
  // Design tokens, replaced as a whole on each edit.
  'tokens',
]);

// What a request may set on a dimension. The name is read apart, on creation
// only: it is write-once (ADR-0015). `standard` is the seed's alone.
const DIMENSION_EDITABLE_FIELDS = Object.freeze([
  'label',
  'description',
  'isActive',
  'order',
  'precedence',
  'parentName',
]);

module.exports = {
  isObjectId,
  validatePayload,
  validateDimensionPayload,
  limitReached,
  EDITABLE_FIELDS,
};

/**
 * The refusal past a cap, carrying the cap: the screen names it rather than
 * answering a bare "limit reached".
 *
 * @param {number} limit
 * @returns {Error} a 409
 */
function limitReached(limit) {
  const error = new Conflict(ERROR_CODES.TAXONOMY_LIMIT_REACHED);
  error.details = { limit };
  return error;
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
  if (payload.parentIds !== undefined) {
    fields.parentIds = readParentIds(payload.parentIds);
  }
  if (payload.tokens !== undefined) fields.tokens = readTokens(payload.tokens);

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

/**
 * @returns {string[]} the ids, checked against the parent dimension by the
 *   service; `null` or `[]` clears the availability: offered under every value.
 */
function readParentIds(value) {
  if (value === null) return [];
  if (!Array.isArray(value)) throw invalid();
  if (value.length > TaxonomyLimits.ITEMS_PER_COMPANY) throw invalid();
  if (value.some((id) => typeof id !== 'string' || !isObjectId(id))) {
    throw invalid();
  }
  if (new Set(value).size !== value.length) throw invalid();
  return value;
}

/**
 * @returns {Object} name → value; `null` clears them. Each name is one a
 *   template reads as a property, like a dimension's (ADR-0015).
 */
function readTokens(value) {
  if (value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const entries = Object.entries(value);
  // Told with the limit, like the other caps, rather than as a bare 400.
  if (entries.length > TaxonomyLimits.TOKENS_PER_VALUE) {
    throw limitReached(TaxonomyLimits.TOKENS_PER_VALUE);
  }
  entries.forEach(([name, token]) => {
    if (!DIMENSION_NAME_PATTERN.test(name)) throw invalid();
    if (typeof token !== 'string' || token.trim() === '') throw invalid();
    if (token.length > TaxonomyLimits.TOKEN_VALUE) throw invalid();
  });
  return Object.fromEntries(
    entries.map(([name, token]) => [name, token.trim()])
  );
}

/**
 * @returns {string|null} null takes the dimension back to the first level
 */
function readParentName(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !DIMENSION_NAME_PATTERN.test(value)) {
    throw invalid();
  }
  return value;
}

function readIsActive(value) {
  if (typeof value !== 'boolean') throw invalid();
  return value;
}

function readOrder(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid();
  return value;
}

/**
 * Validate the editable fields of a dimension, on the same rules as a value's:
 * an unknown key is refused, a partial update returns only the keys present.
 *
 * @param {Object} payload
 * @param {Object} options
 * @param {boolean} options.partial
 * @returns {Object} the fields to assign
 */
function validateDimensionPayload(payload, { partial }) {
  const invalidDimension = () => new BadRequest(ERROR_CODES.INVALID_DIMENSION);
  const readOrRefuse = (read, value) => {
    try {
      return read(value);
    } catch (error) {
      throw invalidDimension();
    }
  };

  if (
    Object.keys(payload).some((key) => !DIMENSION_EDITABLE_FIELDS.includes(key))
  ) {
    throw invalidDimension();
  }
  if (!partial && payload.label === undefined) throw invalidDimension();

  const fields = {};
  if (payload.label !== undefined) {
    fields.label = readOrRefuse(readLabel, payload.label);
  }
  if (payload.description !== undefined) {
    fields.description = readOrRefuse(readDescription, payload.description);
  }
  if (payload.isActive !== undefined) {
    fields.isActive = readOrRefuse(readIsActive, payload.isActive);
  }
  if (payload.order !== undefined) {
    fields.order = readOrRefuse(readOrder, payload.order);
  }
  if (payload.precedence !== undefined) {
    fields.precedence = readOrRefuse(readOrder, payload.precedence);
  }
  if (payload.parentName !== undefined) {
    fields.parentName = readOrRefuse(readParentName, payload.parentName);
  }

  if (partial && Object.keys(fields).length === 0) throw invalidDimension();

  return fields;
}
