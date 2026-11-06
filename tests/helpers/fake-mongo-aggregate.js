'use strict';

/**
 * How MongoDB answers an aggregation, for the in-memory fake models: the
 * `$match`, `$unwind` (of a top-level array, given as a string), `$project`,
 * `$sort` and `$limit` stages, read as fake-mongo-query.js reads a find, but
 * for what Mongoose does to a find and not to an aggregation: a string is not
 * cast to an id, and `$elemMatch` is no projection. Any other stage throws,
 * rather than answer what MongoDB would not.
 */

const { matches, sortedBy, projected } = require('./fake-mongo-query.js');

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
