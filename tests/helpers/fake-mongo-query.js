'use strict';

/**
 * How MongoDB reads a query, for the in-memory fake models: which records a
 * filter matches, in which order a sort puts them, what a projection keeps.
 * Where the fakes would answer something MongoDB
 * would not, these throw.
 *
 * - **Filters**: equality (an array field matches one of its elements, or the
 *   same array), `$in`, `$nin`, `$ne`, `$exists` (a stored `null` exists),
 *   `$gt`, `$gte`, `$lt`, `$lte`, `$regex` (a string with `$options`, or a
 *   RegExp with its own flags), a bare RegExp, `$size` (an array of that
 *   length), `$or`, `$and`, `$nor`. A dotted path reads an embedded document,
 *   and each element of an array on its way. Any other operator, a positional
 *   path (`versions.0`) or an embedded document as a value throws.
 * - **Sort and projection**: objects or strings, as Mongoose takes them. A
 *   projection keeps or drops dotted paths, and `$elemMatch` keeps the first
 *   element of an array that matches.
 * - **Aggregation**: in fake-mongo-aggregate.js, through these: its `$match`
 *   does not cast a string to an id, and its `$project` refuses `$elemMatch`.
 */

const {
  isPlainObject,
  comparable,
  equals,
  equalityOf,
} = require('./fake-mongo-equality.js');

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

function matchesCondition(actual, condition, how) {
  const same = equalityOf(how);
  if (condition instanceof RegExp) return testsString(actual, condition);
  if (!isPlainObject(condition)) return same(actual, condition);
  return Object.entries(condition).every(([operator, operand]) => {
    switch (operator) {
      case '$in':
        return operand.some((value) =>
          value instanceof RegExp
            ? testsString(actual, value)
            : same(actual, value)
        );
      case '$nin':
        return !operand.some((value) => same(actual, value));
      case '$ne':
        return !same(actual, operand);
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

// What a dotted path reaches, as MongoDB walks it: into an embedded document,
// and through an array into each of its elements.
function valueAt(record, path) {
  return path.split('.').reduce((value, key) => {
    if (/^\d+$/.test(key)) {
      throw new Error(
        `fake models: the positional path ${path} is not supported`
      );
    }
    if (Array.isArray(value)) {
      const reached = value
        .map((element) => (isPlainObject(element) ? element[key] : undefined))
        .filter((element) => element !== undefined);
      return reached.length ? reached.flat() : undefined;
    }
    return isPlainObject(value) ? value[key] : undefined;
  }, record);
}

/**
 * @param {Object} record
 * @param {Object} [filter]
 * @param {Object} [options]
 * @param {boolean} [options.castsIds=true] whether a string finds an id, as
 *   through Mongoose; an aggregation's `$match` does not cast
 * @returns {boolean}
 */
function matches(record, filter = {}, { castsIds = true } = {}) {
  const part = (sub) => matches(record, sub, { castsIds });
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$or') return condition.some(part);
    if (key === '$and') return condition.every(part);
    if (key === '$nor') return !condition.some(part);
    if (key.startsWith('$')) {
      throw new Error(`fake models: ${key} is not supported`);
    }
    return matchesCondition(
      key.includes('.') ? valueAt(record, key) : record[key],
      condition,
      { key, castsIds }
    );
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

const entriesOf = (projection) =>
  typeof projection === 'string'
    ? projection
        .split(/\s+/)
        .filter(Boolean)
        .map((key) => (key.startsWith('-') ? [key.slice(1), 0] : [key, 1]))
    : Object.entries(projection);

// A copy of a value without a dotted path, through the arrays on its way.
function withoutPath(value, [key, ...rest]) {
  if (Array.isArray(value)) {
    return value.map((element) => withoutPath(element, [key, ...rest]));
  }
  if (!isPlainObject(value) || !(key in value)) return value;
  const { [key]: dropped, ...others } = value;
  return rest.length ? { ...value, [key]: withoutPath(dropped, rest) } : others;
}

// `{ versions: { status: true } }` for `'versions.status'`: what an inclusion
// keeps, as a tree.
function inclusionTree(keys) {
  const tree = {};
  keys.forEach((key) => {
    const segments = key.split('.');
    const last = segments.pop();
    const node = segments.reduce((parent, segment) => {
      if (parent[segment] === true) return {};
      parent[segment] = parent[segment] || {};
      return parent[segment];
    }, tree);
    node[last] = true;
  });
  return tree;
}

// An embedded document keeps the included paths, an array keeps its embedded
// documents so reduced, and a scalar on the way is dropped.
function picked(value, tree) {
  if (Array.isArray(value)) {
    return value.filter(isPlainObject).map((element) => picked(element, tree));
  }
  const copy = {};
  Object.entries(tree).forEach(([key, node]) => {
    const field = value[key];
    if (field === undefined) return;
    if (node === true) copy[key] = field;
    else if (Array.isArray(field) || isPlainObject(field)) {
      copy[key] = picked(field, node);
    }
  });
  return copy;
}

function elemMatched(record, key, condition) {
  if (key.includes('.')) {
    throw new Error(`fake models: $elemMatch on ${key} is not supported`);
  }
  const list = record[key];
  const element = Array.isArray(list)
    ? list.find((candidate) => matches(candidate, condition))
    : undefined;
  return element === undefined ? undefined : [element];
}

// `{ name: 1 }`, `{ id: '$_id' }`, `{ data: 0 }`, `'name -data'`,
// `{ 'versions.body': 1 }` or `{ versions: { $elemMatch: { status: 'ACTIVE' } } }`.
// `_id` is kept unless excluded. An aggregation's `$project` refuses
// `$elemMatch`, as MongoDB does.
function projected(record, projection, { aggregation = false } = {}) {
  if (!projection) return { ...record };
  const entries = entriesOf(projection);
  if (entries.every(([, value]) => value === 0)) {
    return entries.reduce((copy, [key]) => withoutPath(copy, key.split('.')), {
      ...record,
    });
  }
  const excludesId = entries.some(([key, value]) => key === '_id' && !value);
  const included = entries
    .filter(([key, value]) => value === 1 && key !== '_id')
    .map(([key]) => key);
  const copy = {
    ...(excludesId || record._id === undefined ? {} : { _id: record._id }),
    ...picked(record, inclusionTree(included)),
  };
  entries.forEach(([key, value]) => {
    if (typeof value === 'string' && value.startsWith('$')) {
      copy[key] = record[value.slice(1)];
    }
    if (isPlainObject(value) && '$elemMatch' in value) {
      if (aggregation) {
        throw new Error(
          'fake models: $elemMatch is not supported in an aggregation $project'
        );
      }
      const element = elemMatched(record, key, value.$elemMatch);
      if (element) copy[key] = element;
    }
  });
  return copy;
}

module.exports = { equals, matches, sortedBy, projected };
