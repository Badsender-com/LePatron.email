'use strict';

/**
 * How MongoDB reads a query, for the in-memory fake models: which records a
 * filter matches, in which order a sort puts them, what a projection keeps.
 * Where the fakes would answer something MongoDB would not, these throw.
 *
 * - **Filters**: equality (an array field matches one of its elements, or the
 *   same array), `$in`, `$nin`, `$ne`, `$exists` (a stored `null` exists),
 *   `$gt`, `$gte`, `$lt`, `$lte`, `$regex` (a string with `$options`, or a
 *   RegExp with its own flags), a bare RegExp, `$size` (an array of that
 *   length), `$or`, `$and`, `$nor`. Any other
 *   operator, a dotted path or an embedded document throws.
 * - **Sort and projection**: objects or strings, as Mongoose takes them.
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

function regexOf(pattern, options = '') {
  if (pattern instanceof RegExp) {
    const flags = [...new Set(pattern.flags + options)].join('');
    return new RegExp(pattern.source, flags);
  }
  return new RegExp(pattern, options);
}

const testsString = (actual, regex) =>
  (Array.isArray(actual) ? actual : [actual]).some(
    (value) => typeof value === 'string' && regex.test(value)
  );

const ORDER = {
  $gt: (a, b) => a > b,
  $gte: (a, b) => a >= b,
  $lt: (a, b) => a < b,
  $lte: (a, b) => a <= b,
};

function matchesCondition(actual, condition) {
  if (condition instanceof RegExp) return testsString(actual, condition);
  if (!isPlainObject(condition)) return equals(actual, condition);
  return Object.entries(condition).every(([operator, operand]) => {
    switch (operator) {
      case '$in':
        return operand.some((value) =>
          value instanceof RegExp
            ? testsString(actual, value)
            : equals(actual, value)
        );
      case '$nin':
        return !operand.some((value) => equals(actual, value));
      case '$ne':
        return !equals(actual, operand);
      case '$exists':
        return operand ? actual !== undefined : actual === undefined;
      case '$regex':
        return testsString(actual, regexOf(operand, condition.$options));
      case '$size':
        return Array.isArray(actual) && actual.length === operand;
      case '$options':
        if (!('$regex' in condition)) {
          throw new Error('fake models: $options without $regex');
        }
        return true;
      default:
        if (ORDER[operator]) {
          return (
            actual !== undefined &&
            actual !== null &&
            ORDER[operator](comparable(actual), comparable(operand))
          );
        }
        throw new Error(
          `fake models: ${
            operator.startsWith('$') ? operator : 'an embedded document'
          } is not supported`
        );
    }
  });
}

function matches(record, filter = {}) {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$or') return condition.some((part) => matches(record, part));
    if (key === '$and') return condition.every((part) => matches(record, part));
    if (key === '$nor') return !condition.some((part) => matches(record, part));
    if (key.startsWith('$') || key.includes('.')) {
      throw new Error(`fake models: ${key} is not supported`);
    }
    return matchesCondition(record[key], condition);
  });
}

function directionOf(value) {
  if ([1, '1', 'asc', 'ascending'].includes(value)) return 1;
  if ([-1, '-1', 'desc', 'descending'].includes(value)) return -1;
  throw new Error(`fake models: sort direction ${value} is not supported`);
}

// `{ name: 1, updatedAt: 'desc' }` or `'name -updatedAt'`.
function sortKeys(spec) {
  if (typeof spec === 'string') {
    return spec
      .split(/\s+/)
      .filter(Boolean)
      .map((key) => (key.startsWith('-') ? [key.slice(1), -1] : [key, 1]));
  }
  return Object.entries(spec).map(([key, value]) => [key, directionOf(value)]);
}

// Orders like MongoDB's `sort`: binary order of the values, so uppercase
// sorts before lowercase, and a missing value first.
function sortedBy(spec, list) {
  if (!spec) return list;
  const keys = sortKeys(spec);
  const compare = (a, b) => {
    const left = comparable(a);
    const right = comparable(b);
    if (left === right) return 0;
    if (left === undefined || left === null) return -1;
    if (right === undefined || right === null) return 1;
    return left < right ? -1 : 1;
  };
  return [...list].sort((a, b) => {
    for (const [key, direction] of keys) {
      const order = compare(a[key], b[key]);
      if (order !== 0) return order * direction;
    }
    return 0;
  });
}

// `{ name: 1 }`, `{ id: '$_id' }`, `{ data: 0 }` or `'name -data'`. `_id` is
// kept unless excluded.
function projected(record, projection) {
  if (!projection) return { ...record };
  const entries =
    typeof projection === 'string'
      ? projection
          .split(/\s+/)
          .filter(Boolean)
          .map((key) => (key.startsWith('-') ? [key.slice(1), 0] : [key, 1]))
      : Object.entries(projection);
  if (entries.every(([, value]) => value === 0)) {
    const copy = { ...record };
    entries.forEach(([key]) => delete copy[key]);
    return copy;
  }
  const excludesId = entries.some(([key, value]) => key === '_id' && !value);
  const copy = excludesId ? {} : { _id: record._id };
  entries.forEach(([key, value]) => {
    if (value === 1 && record[key] !== undefined) copy[key] = record[key];
    if (typeof value === 'string' && value.startsWith('$')) {
      copy[key] = record[value.slice(1)];
    }
  });
  return copy;
}

module.exports = { equals, matches, sortedBy, projected };
