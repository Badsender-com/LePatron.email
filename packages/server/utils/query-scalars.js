'use strict';

const createError = require('http-errors');
const { Types } = require('mongoose');

/**
 * Guards for turning untrusted query-string values into Mongo query operands.
 *
 * Express parses `?status[$ne]=` into an OBJECT, so a filter written as
 * `if (status) query.status = status` hands a Mongo operator straight to the
 * driver. Behind a super-admin guard that leaks nothing (the caller already
 * reads everything), but it produces 500s and unbounded Mongo work, and
 * `search` was already escaped — the inconsistency was the tell.
 */

/**
 * A query filter must be a plain scalar. Anything else (object, array,
 * operator) is rejected with a 400 rather than reaching the driver.
 */
function scalarParam(value, name) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'object') {
    throw createError(400, `Invalid "${name}" filter: expected a single value`);
  }
  return String(value);
}

/**
 * Same, restricted to a known set of values.
 */
function enumParam(value, name, allowed) {
  const scalar = scalarParam(value, name);
  if (scalar === undefined) return undefined;
  if (!allowed.includes(scalar)) {
    throw createError(
      400,
      `Invalid "${name}" filter: expected one of ${allowed.join(', ')}`
    );
  }
  return scalar;
}

/**
 * An ObjectId param. A malformed id used to surface as a Mongoose CastError
 * turned 500; it is a bad request.
 */
function objectIdParam(value, name) {
  if (value === undefined || value === null || value === '') return undefined;
  // An ObjectId instance comes from our own code, not from a query string.
  if (value instanceof Types.ObjectId) return value;
  const scalar = scalarParam(value, name);
  if (scalar === undefined) return undefined;
  if (!Types.ObjectId.isValid(scalar)) {
    throw createError(400, `Invalid "${name}": not an identifier`);
  }
  return scalar;
}

/**
 * A date param. An unparseable date used to reach Mongo as `Invalid Date`.
 */
function dateParam(value, name) {
  const scalar = scalarParam(value, name);
  if (scalar === undefined) return undefined;
  const date = new Date(scalar);
  if (Number.isNaN(date.getTime())) {
    throw createError(400, `Invalid "${name}": not a date`);
  }
  return date;
}

/** Escape a user string used inside a RegExp. */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  scalarParam,
  enumParam,
  objectIdParam,
  dateParam,
  escapeRegex,
};
