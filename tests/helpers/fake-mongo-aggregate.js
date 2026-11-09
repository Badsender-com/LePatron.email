'use strict';

/**
 * How MongoDB answers an aggregation, for the in-memory fake models: the
 * `$match`, `$unwind` (of a top-level array, given as a string), `$project`,
 * `$sort`, `$limit` and `$group` stages, read as fake-mongo-query.js reads a
 * find, but for what Mongoose does to a find and not to an aggregation: a
 * string is not cast to an id, and `$elemMatch` is no projection. A `$group`
 * keys on a top-level field (`'$_mailing'`) and accumulates with `$first` of
 * a field or `$sum` of a number or a field, its groups in the order their
 * first document came. Any other stage or accumulator throws, rather than
 * answer what MongoDB would not.
 */

const { matches, sortedBy, projected } = require('./fake-mongo-query.js');
const { comparable } = require('./fake-mongo-equality.js');

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

// `$group: { _id: '$_mailing', decision: { $first: '$decision' } }`.
function grouped(documents, { _id: key, ...accumulators }) {
  const field = fieldOf(key, '$group by');
  const groups = new Map();
  documents.forEach((document) => {
    // A missing field groups with null, as MongoDB groups it.
    const value = comparable(document[field] ?? null);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(document);
  });
  return [...groups.values()].map((members) => ({
    _id: members[0][field] ?? null,
    ...Object.fromEntries(
      Object.entries(accumulators).map((entry) => accumulated(members, entry))
    ),
  }));
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
    documents.map((document) =>
      projected(document, projection, { aggregation: true })
    ),
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
