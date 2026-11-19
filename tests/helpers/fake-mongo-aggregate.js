'use strict';

/**
 * How MongoDB answers an aggregation, for the in-memory fake models: the
 * `$match`, `$unwind` (of a top-level array, given as a string), `$project`,
 * `$sort`, `$limit` and `$group` stages, read as fake-mongo-query.js reads a
 * find, but for what Mongoose does to a find and not to an aggregation: a
 * string is not cast to an id, and `$elemMatch` is no projection. A `$project`
 * also computes a field with `$strLenCP` (a string's length in code points,
 * an error for anything else) and `$ifNull`, of a top-level field or a value.
 * A `$group` keys on a field (`'$_mailing'`, `'$about.id'`) and accumulates with
 * `$first` of a field or `$sum` of a number or a field, its groups in the
 * order their first document came. Any other stage, operator or accumulator
 * throws, rather than answer what MongoDB would not.
 */

const { matches, sortedBy, projected } = require('./fake-mongo-query.js');
const { comparable, isPlainObject } = require('./fake-mongo-equality.js');

// `'$field'`: a top-level field of the document.
function fieldOf(expression, what) {
  if (typeof expression !== 'string' || !/^\$[^.$]+$/.test(expression)) {
    throw new Error(
      `fake models: ${what} ${JSON.stringify(expression)} is not supported`
    );
  }
  return expression.slice(1);
}

// A number counts once per document; a field adds its numbers, nothing else.
function sumOf(documents, expression) {
  if (typeof expression === 'number') return expression * documents.length;
  const field = fieldOf(expression, '$sum of');
  return documents.reduce(
    (total, document) =>
      typeof document[field] === 'number' ? total + document[field] : total,
    0
  );
}

const ACCUMULATORS = {
  $first: (documents, expression) =>
    documents[0][fieldOf(expression, '$first of')],
  $sum: sumOf,
};

function accumulated(documents, [field, accumulator]) {
  const [[name, expression], ...others] = Object.entries(accumulator);
  if (others.length || !ACCUMULATORS[name]) {
    throw new Error(`fake models: the accumulator ${name} is not supported`);
  }
  return [field, ACCUMULATORS[name](documents, expression)];
}

// `'$about.id'`: what a path reaches through embedded documents.
function keyOf(expression) {
  if (typeof expression !== 'string' || !/^\$[^$]+$/.test(expression)) {
    throw new Error(
      `fake models: $group by ${JSON.stringify(expression)} is not supported`
    );
  }
  const path = expression.slice(1).split('.');
  return (document) =>
    path.reduce(
      (value, key) => (isPlainObject(value) ? value[key] : undefined),
      document
    );
}

// `$group: { _id: '$_mailing', decision: { $first: '$decision' } }`.
function grouped(documents, { _id: key, ...accumulators }) {
  const read = keyOf(key);
  const groups = new Map();
  documents.forEach((document) => {
    // A missing field groups with null, as MongoDB groups it.
    const value = comparable(read(document) ?? null);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(document);
  });
  return [...groups.values()].map((members) => ({
    _id: read(members[0]) ?? null,
    ...Object.fromEntries(
      Object.entries(accumulators).map((entry) => accumulated(members, entry))
    ),
  }));
}

// The value of an expression for a document: `'$field'`, a literal, or one
// of the operators below.
function evaluated(document, expression) {
  if (typeof expression === 'string' && expression.startsWith('$')) {
    return document[fieldOf(expression, 'the expression')];
  }
  if (!isPlainObject(expression)) return expression;
  const [[name, argument], ...others] = Object.entries(expression);
  if (others.length || !OPERATORS[name]) {
    throw new Error(`fake models: the operator ${name} is not supported`);
  }
  return OPERATORS[name](document, argument);
}

// The BSON type MongoDB names in an error, for the values a record holds.
function bsonTypeOf(value) {
  if (value === undefined) return 'missing';
  if (value === null) return 'null';
  if (typeof value === 'number') {
    return Number.isInteger(value) && Math.abs(value) < 2 ** 31
      ? 'int'
      : 'double';
  }
  if (typeof value === 'boolean') return 'bool';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

const OPERATORS = {
  // Code points, not the UTF-16 units of `length`. MongoDB fails the whole
  // aggregation on anything but a string: a missing field and null too.
  $strLenCP: (document, argument) => {
    const value = evaluated(document, argument);
    if (typeof value !== 'string') {
      throw new Error(
        `$strLenCP requires a string argument, found: ${bsonTypeOf(value)}`
      );
    }
    return [...value].length;
  },
  // A missing field or null gives the replacement.
  $ifNull: (document, [value, replacement]) =>
    evaluated(document, value) ?? evaluated(document, replacement),
};

const isExpression = (value) =>
  isPlainObject(value) && !('$elemMatch' in value);

// What a find projects, then the fields an expression computes. A computed
// field makes it an inclusion: of the `_id`, unless it is left out.
function projectedWith(document, projection) {
  const entries = Object.entries(projection);
  const computed = entries.filter(([, value]) => isExpression(value));
  const kept = Object.fromEntries(
    entries.filter(([, value]) => !isExpression(value))
  );
  const fields = Object.keys(kept).filter((field) => field !== '_id');
  const base =
    computed.length && !fields.length
      ? kept._id === 0 || kept._id === false
        ? {}
        : { _id: document._id }
      : projected(document, kept, { aggregation: true });
  return {
    ...base,
    ...Object.fromEntries(
      computed.map(([field, expression]) => [
        field,
        evaluated(document, expression),
      ])
    ),
  };
}

// `$unwind: '$versions'`: one document per element of a top-level array, none
// for a document whose array is missing or empty.
function unwound(documents, path) {
  if (typeof path !== 'string' || !/^\$[^.$]+$/.test(path)) {
    throw new Error(
      `fake models: $unwind of ${JSON.stringify(path)} is not supported`
    );
  }
  const key = path.slice(1);
  return documents.flatMap((document) => {
    const value = document[key];
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) return [document];
    return value.map((element) => ({ ...document, [key]: element }));
  });
}

// Nothing casts an aggregation's values: a string never finds an id, which
// MongoDB stores as an ObjectId. `$elemMatch` is a find projection only.
const STAGES = {
  $match: (documents, filter) =>
    documents.filter((document) =>
      matches(document, filter, { castsIds: false })
    ),
  $unwind: unwound,
  $project: (documents, projection) =>
    documents.map((document) => projectedWith(document, projection)),
  $sort: (documents, spec) => sortedBy(spec, documents),
  $limit: (documents, count) => documents.slice(0, count),
  $group: grouped,
};

function aggregated(records, pipeline) {
  return pipeline.reduce((documents, stage) => {
    const [[name, spec], ...others] = Object.entries(stage);
    if (others.length || !STAGES[name]) {
      throw new Error(`fake models: the stage ${name} is not supported`);
    }
    return STAGES[name](documents, spec);
  }, records);
}

module.exports = { aggregated };
