'use strict';

const { BadRequest, Conflict } = require('http-errors');

const ERROR_CODES = require('../../constant/error-codes.js');
const {
  TaxonomyLimits,
  DIMENSION_NAME_PATTERN,
  RESERVED_DIMENSION_NAMES,
} = require('../../constant/taxonomy-type.js');
const {
  isTokenValue,
  RESERVED_TOKEN_NAMES,
} = require('../../../shared/taxonomy/constants.js');
const {
  ROLES: DIMENSION_ROLES,
} = require('../../../shared/locale/locale-codes.js');

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
  // The normalised code, checked against the dimension's role by the service.
  'code',
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
  'role',
]);

module.exports = {
  isObjectId,
  validatePayload,
  validateDimensionPayload,
  readDimensionName,
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
  if (payload.code !== undefined) fields.code = readCode(payload.code);

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
  if (value.length > TaxonomyLimits.VALUES_PER_DIMENSION) throw invalid();
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
    // Read by a template like a dimension's name, and bounded like it.
    if (name.length > TaxonomyLimits.DIMENSION_NAME) throw invalid();
    // Published to the root property of the same name, like a dimension: never
    // a piece of the content the editor builds, a name every object answers
    // to, nor `locale`, reserved for the email's language, which the template
    // receives under that name (ADR-0023): packages/shared/taxonomy/constants.js.
    if (RESERVED_TOKEN_NAMES.includes(name)) throw invalid();
    if (typeof token !== 'string' || token.trim() === '') throw invalid();
    if (token.length > TaxonomyLimits.TOKEN_VALUE) throw invalid();
    // A value a template prints inside a style or an attribute, never markup
    // or CSS that would close it (packages/shared/taxonomy/constants.js).
    if (!isTokenValue(token.trim())) throw invalid();
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

// The list it belongs to depends on the dimension's role: the service checks it.
function readCode(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw invalid();
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
  if (payload.role !== undefined) {
    if (payload.role !== null && !DIMENSION_ROLES.includes(payload.role)) {
      throw invalidDimension();
    }
    fields.role = payload.role;
  }

  if (partial && Object.keys(fields).length === 0) throw invalidDimension();

  return fields;
}

/**
 * A dimension's name, as a template will read it (ADR-0015): checked here
 * rather than left to the schema, whose refusal would answer a 500.
 *
 * @param {*} value
 * @returns {string} the name
 */
function readDimensionName(value) {
  if (typeof value !== 'string' || !DIMENSION_NAME_PATTERN.test(value)) {
    throw new BadRequest(ERROR_CODES.INVALID_DIMENSION);
  }
  if (value.length > TaxonomyLimits.DIMENSION_NAME) {
    const error = new BadRequest(ERROR_CODES.DIMENSION_NAME_TOO_LONG);
    error.details = { limit: TaxonomyLimits.DIMENSION_NAME };
    throw error;
  }
  // Valid as a template property, but a name every object already answers to,
  // under which a value would be lost (`__proto__`) or read back as an
  // inherited function, or a piece of the content the editor builds, which
  // publishing the dimension would overwrite (packages/shared/taxonomy/constants.js).
  if (RESERVED_DIMENSION_NAMES.includes(value)) {
    throw new BadRequest(ERROR_CODES.DIMENSION_NAME_RESERVED);
  }
  return value;
}
