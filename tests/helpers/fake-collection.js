'use strict';

/**
 * A generic in-memory stand-in for one Mongoose 5.13 model, for service tests.
 *
 * fake-listing-models.js and fake-user-models.js fake the models their tests
 * need, with the virtuals and methods of those schemas. This one fakes any
 * model: the taxonomy acceptance tests need dimensions, values and mailings
 * that they create, update and delete through the services, not only read.
 * Filters, sort and projection are read as MongoDB reads them, by
 * fake-mongo-query.js, and updates applied by fake-mongo-update.js; a query is
 * a thenable of fake-query.js. Where the
 * fake would answer something Mongoose would not, it throws: an operator, an
 * option or a method argument it does not know is an error, never ignored.
 *
 * - **Schema**: `schema` plugs a real Mongoose schema (fake-schema.js). Inserts
 *   and `save()` cast and validate the record (enum, `trim`, ids, `required`…)
 *   and set its timestamps; updates cast it, and validate the paths they name
 *   with `runValidators`; documents get the schema's aliases (`group`). Without
 *   one, `defaults` fills fields on insert like a schema's `default:`, and
 *   nothing is cast or validated. `seed` never validates: it writes fixtures as
 *   a direct insert in MongoDB would.
 * - **Unique indexes**: `unique` lists compound unique indexes; a duplicate
 *   answers the MongoDB error code 11000.
 * - **Answers**: as Mongoose 5.13 gives them. `exists` is a boolean;
 *   `updateOne` and `updateMany` answer `{ n, nModified, ok }`, nModified
 *   counting the documents that actually changed (with the schema's
 *   timestamps, every matched one: Mongoose sets `updatedAt`); `deleteOne` and `deleteMany`
 *   answer `{ n, ok, deletedCount }`; `findOneAndUpdate` answers the document
 *   as it was before the update unless `{ new: true }`.
 * - **Documents**: a `.lean()` query answers the stored fields, projected;
 *   otherwise a document of the projected fields (fake-document.js), whose
 *   `save()` writes only the fields it changed, so a projected document saved
 *   keeps the fields it did not load.
 */

const { Types } = require('mongoose');

const { equals, matches, sortedBy } = require('./fake-mongo-query.js');
const { copyOf, applyUpdate } = require('./fake-mongo-update.js');
const { fakeSchema } = require('./fake-schema.js');
const { fakeDocument, same } = require('./fake-document.js');
const { fakeQuery } = require('./fake-query.js');

function assertOptions(method, options, supported) {
  Object.keys(options || {}).forEach((option) => {
    if (!supported.includes(option)) {
      throw new Error(
        `fake models: option ${option} of ${method} is not supported`
      );
    }
  });
}

/**
 * @param {Object} [options]
 * @param {import('mongoose').Schema} [options.schema] casts, validates and
 *   gives its defaults, timestamps and aliases
 * @param {Object} [options.defaults] without a schema, fields set on insert
 *   when absent
 * @param {string[][]} [options.unique] compound unique indexes, eg.
 *   `[['_company', 'name']]`
 * @returns {Object} the model surface, plus `seed`, `all` and `reset` for tests
 */
function fakeCollection({ schema, defaults = {}, unique = [] } = {}) {
  const plugged = fakeSchema(schema);
  const { createdAt, updatedAt } = plugged?.timestamps || {};
  let records = [];

  const indexOf = (id) => records.findIndex((record) => equals(record._id, id));
  const matching = (filter) =>
    records.filter((record) => matches(record, filter));

  function assertUnique(candidate) {
    unique.forEach((keys) => {
      const clash = records.some(
        (record) =>
          !equals(record._id, candidate._id) &&
          keys.every((key) => equals(record[key], candidate[key]))
      );
      if (clash) {
        const error = new Error(`E11000 duplicate key: ${keys.join(', ')}`);
        error.code = 11000;
        throw error;
      }
    });
  }

  function store(record) {
    assertUnique(record);
    const index = indexOf(record._id);
    if (index === -1) records.push(record);
    else records[index] = record;
  }

  function stamped(record, { inserted = false, timestamps = true } = {}) {
    if (!timestamps) return record;
    const now = new Date();
    if (inserted && createdAt && record[createdAt] === undefined) {
      record[createdAt] = now;
    }
    if (updatedAt) record[updatedAt] = now;
    return record;
  }

  // What `save()` writes: the fields the document changed since it was read,
  // and nothing else, like Mongoose's `$set` and `$unset` of modified paths.
  async function saveChanges(loaded, current) {
    const index = indexOf(current._id);
    if (index === -1) {
      const error = new Error(`No document found for _id ${current._id}`);
      error.name = 'DocumentNotFoundError';
      throw error;
    }
    const next = copyOf(records[index]);
    const keys = new Set([...Object.keys(loaded), ...Object.keys(current)]);
    keys.forEach((key) => {
      if (current[key] === undefined) delete next[key];
      else if (!same(current[key], loaded[key]))
        next[key] = copyOf(current[key]);
    });
    const record = plugged ? await plugged.validated(next) : next;
    store(stamped(record));
    return record;
  }

  const toDocument = (record) =>
    fakeDocument(record, { schema: plugged, save: saveChanges });

  const query = (run, options) =>
    fakeQuery(run, {
      ...options,
      shape: (fields, lean) => (lean ? copyOf(fields) : toDocument(fields)),
    });

  const READ_OPTIONS = ['sort', 'limit', 'lean'];

  function read(method, filter, projection, options, { single }) {
    assertOptions(method, options, READ_OPTIONS);
    const chain = query(({ sort }) => sortedBy(sort, matching(filter || {})), {
      single,
      projection,
      sort: options?.sort,
      lean: options?.lean,
    });
    if (options?.limit !== undefined) chain.limit(options.limit);
    return chain;
  }

  function withDefaults(fields) {
    const filled = {
      ...copyOf(plugged ? plugged.defaultsOf() : defaults),
      ...copyOf(fields),
    };
    if (filled._id === undefined) filled._id = new Types.ObjectId();
    return filled;
  }

  async function toInsert(fields) {
    const record = withDefaults(fields);
    const valid = plugged
      ? await plugged.validated(record, { defaults: true })
      : record;
    return stamped(valid, { inserted: true });
  }

  async function insert(fields) {
    const record = await toInsert(fields);
    store(record);
    return toDocument(record);
  }

  async function insertMany(list, options = {}) {
    assertOptions('insertMany', options, ['ordered']);
    const ordered = options.ordered !== false;
    // Mongoose validates every document first: ordered, one invalid document
    // inserts none; unordered, the invalid ones are left out.
    const prepared = await Promise.all(
      list.map((fields) => toInsert(fields).catch((error) => ({ error })))
    );
    const invalid = prepared.find((entry) => entry.error);
    if (ordered && invalid) throw invalid.error;

    const inserted = [];
    const writeErrors = [];
    for (const [index, record] of prepared.entries()) {
      if (record.error) continue;
      try {
        store(record);
        inserted.push(toDocument(record));
      } catch (error) {
        writeErrors.push({ index, code: error.code, errmsg: error.message });
        if (ordered) break;
      }
    }
    if (writeErrors.length > 0) {
      const error = new Error(writeErrors[0].errmsg);
      error.code = 11000;
      error.writeErrors = writeErrors;
      error.insertedDocs = inserted;
      throw error;
    }
    return inserted;
  }

  // Apply an update to one record; answers the stored record and whether the
  // update changed it.
  async function updateRecord(record, update, options = {}) {
    const { next, paths } = applyUpdate(record, update);
    const cast = plugged
      ? await plugged.castUpdate(next, paths, options)
      : next;
    const changed = !same(cast, record);
    // Mongoose sets `updatedAt` on every update, so with timestamps an update
    // always modifies the document, as it does against MongoDB.
    const stored = stamped(cast, { timestamps: options.timestamps !== false });
    store(stored);
    return {
      stored,
      modified: changed || (!!updatedAt && options.timestamps !== false),
    };
  }

  const UPDATE_OPTIONS = ['runValidators', 'timestamps'];

  async function updateAll(method, filter, update, options, { many }) {
    assertOptions(method, options, UPDATE_OPTIONS);
    const found = many ? matching(filter) : matching(filter).slice(0, 1);
    let nModified = 0;
    for (const record of found) {
      const { modified } = await updateRecord(record, update, options || {});
      if (modified) nModified += 1;
    }
    return { n: found.length, nModified, ok: 1 };
  }

  function findOneAndUpdate(filter, update, options = {}) {
    assertOptions('findOneAndUpdate', options, [
      'new',
      'returnOriginal',
      'projection',
      'fields',
      'sort',
      'lean',
      ...UPDATE_OPTIONS,
    ]);
    const { runValidators, timestamps } = options;
    const answersAfter =
      options.new === true || options.returnOriginal === false;
    return query(
      async ({ sort }) => {
        const [record] = sortedBy(sort, matching(filter || {}));
        if (!record) return [];
        const { stored } = await updateRecord(record, update, {
          runValidators,
          timestamps,
        });
        return [answersAfter ? stored : record];
      },
      {
        single: true,
        sort: options.sort,
        projection: options.projection || options.fields,
        lean: options.lean,
      }
    );
  }

  function deleted(count) {
    return { n: count, ok: 1, deletedCount: count };
  }

  return {
    find: (filter, projection, options) =>
      read('find', filter, projection, options, { single: false }),
    findOne: (filter, projection, options) =>
      read('findOne', filter, projection, options, { single: true }),
    findById: (id, projection, options) =>
      read(
        'findById',
        { _id: id === undefined ? null : id },
        projection,
        options,
        {
          single: true,
        }
      ),
    exists: async (filter = {}) => matching(filter).length > 0,
    countDocuments: async (filter = {}) => matching(filter).length,
    create: async (fields, ...rest) => {
      if (rest.length > 0) {
        throw new Error('fake models: create takes one document or one array');
      }
      if (!Array.isArray(fields)) return insert(fields);
      const created = [];
      for (const each of fields) created.push(await insert(each));
      return created;
    },
    insertMany,
    updateOne: (filter, update, options) =>
      updateAll('updateOne', filter, update, options, { many: false }),
    updateMany: (filter, update, options) =>
      updateAll('updateMany', filter, update, options, { many: true }),
    findOneAndUpdate,
    deleteOne: async (filter) => {
      const [record] = matching(filter);
      if (!record) return deleted(0);
      records.splice(indexOf(record._id), 1);
      return deleted(1);
    },
    deleteMany: async (filter = {}) => {
      const before = records.length;
      records = records.filter((record) => !matches(record, filter));
      return deleted(before - records.length);
    },

    // Test side, not part of a model.
    seed: (list) => list.forEach((fields) => store(withDefaults(fields))),
    all: () => records.map(copyOf),
    reset: () => {
      records = [];
    },
  };
}

module.exports = { fakeCollection };
