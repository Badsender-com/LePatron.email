'use strict';

/**
 * An in-memory stand-in for the MongoDB driver's database, for what the app
 * reads and writes through `mongoose.connection.db` rather than a model: the
 * store of the authorization server (mcp-oauth-store.js). There is no test
 * database: each collection answers as the driver the app pins (mongodb 3.6)
 * and the MongoDB it targets (before 5.0) would, and throws where they would.
 *
 * - `createIndex(keys, options)` is recorded in `indexes`.
 * - `updateOne(filter, update, { upsert })` takes `$set` and `$unset`; a
 *   dotted path in them reaches into an embedded document. With `upsert`, a
 *   filter that matches nothing inserts its equalities and the `$set`. It
 *   answers as the driver does: `matchedCount`, `modifiedCount`,
 *   `upsertedCount`, and the server's `result` (`{ n, nModified, ok }`).
 * - A stored key may neither contain a dot nor start with `$`: MongoDB
 *   before 5.0 refuses them, wherever they are in the document.
 * - `findOne(filter, { projection })`, `deleteOne`, `deleteMany` and
 *   `countDocuments` read filters through fake-mongo-query.js. The ids are
 *   strings, as the store keeps them.
 */

const { matches, projected } = require('./fake-mongo-query.js');

const isDate = (value) =>
  Object.prototype.toString.call(value) === '[object Date]';

const isPlainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  !isDate(value);

// A copy in the test's own realm, its dates the test's `Date`.
function copy(value) {
  if (Array.isArray(value)) return value.map(copy);
  if (isDate(value)) return new Date(value.getTime());
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, copy(nested)])
  );
}

// What MongoDB before 5.0 answers to a key it cannot store.
function assertStorable(value, path = '') {
  if (Array.isArray(value)) {
    value.forEach((element) => assertStorable(element, path));
    return;
  }
  if (!isPlainObject(value)) return;
  Object.entries(value).forEach(([key, nested]) => {
    if (key.includes('.') || key.startsWith('$')) {
      throw Object.assign(
        new Error(
          `The dotted field '${key}' in '${path}${key}' is not valid for storage.`
        ),
        { code: 57 }
      );
    }
    assertStorable(nested, `${path}${key}.`);
  });
}

function setPath(record, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const parent = keys.reduce((node, key) => {
    if (!isPlainObject(node[key])) Object.assign(node, { [key]: {} });
    return node[key];
  }, record);
  parent[last] = copy(value);
}

function unsetPath(record, path) {
  const keys = path.split('.');
  const last = keys.pop();
  const parent = keys.reduce(
    (node, key) => (isPlainObject(node) ? node[key] : undefined),
    record
  );
  if (isPlainObject(parent)) delete parent[last];
}

function applyUpdate(record, update) {
  Object.keys(update).forEach((operator) => {
    if (!['$set', '$unset'].includes(operator)) {
      throw new Error(`fake collection: ${operator} is not supported`);
    }
  });
  Object.values(update.$set || {}).forEach((value) => assertStorable(value));
  Object.entries(update.$set || {}).forEach(([path, value]) =>
    setPath(record, path, value)
  );
  Object.keys(update.$unset || {}).forEach((path) => unsetPath(record, path));
}

// The equalities of a filter, which an upsert inserts.
const equalitiesOf = (filter) =>
  Object.fromEntries(
    Object.entries(filter).filter(
      ([key, value]) => !key.startsWith('$') && !isPlainObject(value)
    )
  );

const matching = (filter) => (record) => matches(record, filter);

function createFakeCollection() {
  const records = [];
  const indexes = [];
  const answered = (n, nModified, upserted) => ({
    matchedCount: n,
    modifiedCount: nModified,
    upsertedCount: upserted ? 1 : 0,
    result: { n: n || (upserted ? 1 : 0), nModified, ok: 1 },
  });

  return {
    records,
    indexes,
    createIndex: async (keys, options = {}) => {
      indexes.push({ keys: copy(keys), options: copy(options) });
      return Object.keys(keys).join('_');
    },
    insertOne: async (record) => {
      assertStorable(record);
      if (records.some(matching({ _id: record._id }))) {
        throw Object.assign(new Error('E11000 duplicate key error'), {
          code: 11000,
        });
      }
      records.push(copy(record));
      return { insertedCount: 1, insertedId: record._id };
    },
    updateOne: async (filter, update, { upsert = false } = {}) => {
      const record = records.find(matching(filter));
      if (record) {
        const before = JSON.stringify(record);
        applyUpdate(record, update);
        return answered(1, before === JSON.stringify(record) ? 0 : 1);
      }
      if (!upsert) return answered(0, 0);
      const inserted = copy(equalitiesOf(filter));
      applyUpdate(inserted, update);
      records.push(inserted);
      return answered(0, 0, true);
    },
    findOne: async (filter = {}, { projection } = {}) => {
      const record = records.find(matching(filter));
      return record ? copy(projected(record, projection)) : null;
    },
    deleteOne: async (filter = {}) => {
      const index = records.findIndex(matching(filter));
      if (index !== -1) records.splice(index, 1);
      return { deletedCount: index === -1 ? 0 : 1 };
    },
    deleteMany: async (filter = {}) => {
      const kept = records.filter((record) => !matching(filter)(record));
      const deletedCount = records.length - kept.length;
      records.splice(0, Infinity, ...kept);
      return { deletedCount };
    },
    countDocuments: async (filter = {}) =>
      records.filter(matching(filter)).length,
  };
}

/**
 * A database whose `collection(name)` answers the same fake collection for
 * the same name, as `mongoose.connection.db` would answer the same one.
 *
 * @returns {{ collection: Function, collections: Map<string, Object> }}
 */
function createFakeDb() {
  const collections = new Map();
  return {
    collections,
    collection(name) {
      if (!collections.has(name)) {
        collections.set(name, createFakeCollection());
      }
      return collections.get(name);
    },
  };
}

module.exports = { createFakeDb, createFakeCollection };
