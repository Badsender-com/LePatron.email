'use strict';

/**
 * How MongoDB applies an update document, for the in-memory fake models.
 * Where the fake would write something MongoDB would not, it throws.
 *
 * - `$set`, `$unset`, `$inc`.
 * - `$push` and `$addToSet`: a value, or `{ $each: [...] }` (`$addToSet` adds
 *   each element not already there). `$slice`, `$sort` and `$position` throw.
 * - `$pull`: a value, a condition (`{ $in: [...] }`, `{ $gte: 3 }`), or a query
 *   that the embedded documents of the array are matched against
 *   (`{ _id: id }`).
 * - A plain object with no operator is read as `$set`, as Mongoose does.
 *
 * Top-level fields only, like the filters: a dotted path throws.
 */

const { isPlainObject } = require('./fake-mongo-equality.js');
const { equals, matches } = require('./fake-mongo-query.js');

function copyOf(value) {
  if (value instanceof Map) return new Map(value);
  if (Array.isArray(value)) return value.map(copyOf);
  if (
    value &&
    typeof value === 'object' &&
    !(value instanceof Date) &&
    !value._bsontype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, copyOf(inner)])
    );
  }
  return value;
}

const isOperatorObject = (value) =>
  isPlainObject(value) &&
  Object.keys(value).length > 0 &&
  Object.keys(value).every((key) => key.startsWith('$'));

// The elements `$push` or `$addToSet` adds: `{ $each: [...] }` or one value.
function elementsOf(operator, key, value) {
  if (!isOperatorObject(value)) return [value];
  const modifiers = Object.keys(value).filter((name) => name !== '$each');
  if (modifiers.length > 0 || !Array.isArray(value.$each)) {
    throw new Error(
      `fake models: ${operator} of ${key} with ${
        modifiers.join(', ') || 'a non-array $each'
      } is not supported`
    );
  }
  return value.$each;
}

// Which elements `$pull` removes: a condition on the element itself, a query
// on an embedded document, or an equal value.
function pulls(condition) {
  if (isOperatorObject(condition)) {
    return (element) => matches({ element }, { element: condition });
  }
  if (isPlainObject(condition)) {
    return (element) => isPlainObject(element) && matches(element, condition);
  }
  return (element) => equals(element, condition);
}

const UPDATES = {
  $set: (record, key, value) => {
    record[key] = copyOf(value);
  },
  $unset: (record, key) => {
    delete record[key];
  },
  $inc: (record, key, value) => {
    record[key] = (record[key] || 0) + value;
  },
  $push: (record, key, value) => {
    const added = elementsOf('$push', key, value);
    record[key] = [...(record[key] || []), ...added.map(copyOf)];
  },
  $addToSet: (record, key, value) => {
    const list = [...(record[key] || [])];
    elementsOf('$addToSet', key, value).forEach((element) => {
      if (!list.some((present) => equals(present, element))) {
        list.push(copyOf(element));
      }
    });
    record[key] = list;
  },
  $pull: (record, key, condition) => {
    if (record[key] === undefined) return;
    const removes = pulls(condition);
    record[key] = record[key].filter((element) => !removes(element));
  },
};

/**
 * @param {Object} record the stored record, left untouched
 * @param {Object} update an update document
 * @returns {{ next: Object, paths: string[] }} the updated copy, and the
 *   top-level paths the update names
 */
function applyUpdate(record, update) {
  const next = copyOf(record);
  const isOperator = Object.keys(update).some((key) => key.startsWith('$'));
  const paths = [];
  Object.entries(isOperator ? update : { $set: update }).forEach(
    ([operator, fields]) => {
      if (!UPDATES[operator]) {
        throw new Error(`fake models: update ${operator} is not supported`);
      }
      Object.entries(fields).forEach(([key, value]) => {
        if (key.includes('.')) {
          throw new Error(`fake models: update of ${key} is not supported`);
        }
        UPDATES[operator](next, key, value);
        paths.push(key);
      });
    }
  );
  return { next, paths };
}

module.exports = { copyOf, applyUpdate };
