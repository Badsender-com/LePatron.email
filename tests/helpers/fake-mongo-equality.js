'use strict';

/**
 * When the in-memory fake models take two values for the same, as MongoDB
 * does: a date by its time, an id by its hex, an array by one of its
 * elements or as a whole. Read by fake-mongo-query.js.
 */

const isPlainObject = (value) =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !(value instanceof RegExp) &&
  !value._bsontype;

// What a stored value compares as: a date by its time, an id by its hex.
function comparable(value) {
  if (value instanceof Date) return value.getTime();
  if (value === undefined || value === null) return value;
  if (typeof value === 'number') return value;
  return String(value);
}

function equals(actual, expected) {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      actual.every((element, index) => equals(element, expected[index]))
    );
  }
  if (Array.isArray(actual)) {
    return actual.some((element) => equals(element, expected));
  }
  if (actual === undefined || actual === null) {
    return expected === undefined || expected === null;
  }
  return comparable(actual) === comparable(expected);
}

// An id is an ObjectId in the database (the fixtures store its hex string in
// its place): Mongoose casts a string to it, MongoDB alone does not, so an
// aggregation's `$match` never finds an id by a string.
const isObjectId = (value) =>
  !!value &&
  typeof value === 'object' &&
  /^ObjectI[dD]$/.test(value._bsontype || '');

function equalityOf({ key, castsIds }) {
  if (castsIds) return equals;
  return (actual, expected) =>
    typeof expected === 'string' && (key === '_id' || isObjectId(actual))
      ? false
      : equals(actual, expected);
}

module.exports = { isPlainObject, comparable, equals, equalityOf };
