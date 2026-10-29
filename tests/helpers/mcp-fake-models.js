'use strict';

/**
 * In-memory stand-ins for the models the MCP server reads, for its acceptance
 * tests (epic #1290). There is no test database: like fake-listing-models.js,
 * these answer a query the way Mongoose and MongoDB would (filters, sort and
 * projection through fake-mongo-query.js), so a test seeds records and reads
 * back what the MCP server answers, whatever query it builds.
 *
 * - A `.lean()` query answers copies of the stored fields; otherwise a
 *   document also has `id` and `toObject()` / `toJSON()`.
 * - `populate` is not supported: it throws, rather than answer a document
 *   MongoDB would have filled.
 * - Each collection the seed names is a model; the others are empty.
 */

const { matches, sortedBy, projected } = require('./fake-mongo-query.js');

// Collection → the name `models.common.js` exports it under.
const MODELS = {
  groups: 'Groups',
  users: 'Users',
  workspaces: 'Workspaces',
  folders: 'Folders',
  mailings: 'Mailings',
  comments: 'Comments',
  expertises: 'Expertises',
  skills: 'LePatronSkills',
};

// Node 17+, given to the test files by node-globals-environment.js.
/* global structuredClone */
const copy = (record) => structuredClone(record);

function toDocument(record) {
  const doc = { ...copy(record), id: String(record._id) };
  Object.defineProperty(doc, 'toObject', { value: () => copy(record) });
  Object.defineProperty(doc, 'toJSON', { value: () => ({ ...doc }) });
  return doc;
}

// Mongoose queries are thenables with a fluent API.
function query(list, shape) {
  let sortSpec;
  let selectSpec;
  let limit;
  let skip = 0;
  let lean = false;
  const resolve = () => {
    const sorted = sortedBy(sortSpec, list()).slice(skip);
    const page = limit === undefined ? sorted : sorted.slice(0, limit);
    const shaped = page.map((record) =>
      selectSpec ? projected(record, selectSpec) : record
    );
    return shape(shaped.map(lean ? copy : toDocument));
  };
  const chain = {
    sort(spec) {
      sortSpec = spec;
      return chain;
    },
    select(spec) {
      selectSpec = spec;
      return chain;
    },
    limit(count) {
      limit = count;
      return chain;
    },
    skip(count) {
      skip = count;
      return chain;
    },
    lean() {
      lean = true;
      return chain;
    },
    populate() {
      throw new Error('fake MCP models: populate is not supported');
    },
    exec: () => Promise.resolve().then(resolve),
    then: (onFulfilled, onRejected) =>
      Promise.resolve().then(resolve).then(onFulfilled, onRejected),
  };
  return chain;
}

function model(records) {
  const matching = (filter) => () =>
    records.filter((record) => matches(record, filter));
  return {
    find: (filter = {}, projection) => {
      const q = query(matching(filter), (docs) => docs);
      return projection ? q.select(projection) : q;
    },
    findOne: (filter = {}, projection) => {
      const q = query(matching(filter), (docs) => docs[0] || null);
      return projection ? q.select(projection) : q;
    },
    findById: (id, projection) => {
      const q = query(matching({ _id: id }), (docs) => docs[0] || null);
      return projection ? q.select(projection) : q;
    },
    countDocuments: (filter = {}) => Promise.resolve(matching(filter)().length),
    distinct: (field, filter = {}) =>
      Promise.resolve([
        ...new Set(matching(filter)().flatMap((record) => record[field])),
      ]),
  };
}

function createMcpStore() {
  const collections = {};
  const models = {};
  Object.entries(MODELS).forEach(([collection, name]) => {
    collections[collection] = [];
    models[name] = model(collections[collection]);
  });

  return {
    models,

    // Empties every collection, then stores the records as given.
    seed(records = {}) {
      Object.keys(collections).forEach((collection) => {
        collections[collection].splice(
          0,
          Infinity,
          ...(records[collection] || []).map(copy)
        );
      });
    },

    update(collection, id, changes) {
      const record = collections[collection].find(
        (candidate) => String(candidate._id) === String(id)
      );
      if (!record) {
        throw new Error(`fake MCP models: no ${collection} record ${id}`);
      }
      Object.assign(record, changes);
    },
  };
}

module.exports = { createMcpStore, MODELS };
