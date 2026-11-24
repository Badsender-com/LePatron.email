'use strict';

const { BadRequest } = require('http-errors');

const ERROR_CODES = require('../../constant/error-codes.js');
const {
  DimensionScopes,
  DIMENSION_NAME_PATTERN,
} = require('../../constant/taxonomy-type.js');
const {
  ROLES: DIMENSION_ROLES,
} = require('../../../shared/locale/locale-codes.js');
const { fieldReaders } = require('./taxonomy.validation.js');

const { readLabel, readDescription, readIsActive, readOrder } = fieldReaders;

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
  'scope',
]);

module.exports = { validateDimensionPayload };

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
  if (payload.scope !== undefined) {
    const scopes = Object.values(DimensionScopes);
    if (!scopes.includes(payload.scope)) throw invalidDimension();
    fields.scope = payload.scope;
  }

  if (partial && Object.keys(fields).length === 0) throw invalidDimension();

  return fields;
}

/**
 * @returns {string|null} null takes the dimension back to the first level
 */
function readParentName(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !DIMENSION_NAME_PATTERN.test(value)) {
    throw new BadRequest(ERROR_CODES.INVALID_DIMENSION);
  }
  return value;
}
