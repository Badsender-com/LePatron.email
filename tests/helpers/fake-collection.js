'use strict';

/**
 * A generic in-memory stand-in for one Mongoose model, for service tests.
 *
 * fake-listing-models.js and fake-user-models.js fake the models their tests
 * need, with the virtuals and methods of those schemas. This one fakes any model
 * with no virtual: the taxonomy acceptance tests need dimensions, values and
 * mailings that they create, update and delete through the services, not only
 * read. Filters, sort and projection are read as MongoDB reads them, by
 * fake-mongo-query.js; where the fake would answer something MongoDB would not,
 * it throws.
 *
 * - **Schema stand-ins**: `defaults` fills fields on insert like a schema's
 *   `default:`; `unique` lists compound unique indexes, and a duplicate answers
 *   the MongoDB error code 11000. No other validation runs.
 * - **Documents**: a `.lean()` query answers the stored fields only. Otherwise a
 *   document has `id`, `save()`, `toObject()` and `toJSON()`, non-enumerable so a
 *   test comparing it with `toEqual` sees data. Never the stored record itself:
 *   changing a document without saving it changes nothing.
 * - **Updates**: `$set`, `$unset`, `$inc`, `$push`, `$addToSet`, `$pull` (a value
 *   or `{ $in: [...] }`), or a plain object read as `$set`. Top-level fields
 *   only, like the filters.
 */

const { Types } = require('mongoose');
const {
  equals,
  matches,
  sortedBy,
  projected,
} = require('./fake-mongo-query.js');

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

function pulled(list = [], condition) {
  const removes =
    condition && typeof condition === 'object' && '$in' in condition
      ? (element) => condition.$in.some((value) => equals(element, value))
      : (element) => equals(element, condition);
  return list.filter((element) => !removes(element));
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
    record[key] = [...(record[key] || []), copyOf(value)];
  },
  $addToSet: (record, key, value) => {
    const list = record[key] || [];
    if (!list.some((element) => equals(element, value))) {
      record[key] = [...list, copyOf(value)];
    }
  },
  $pull: (record, key, condition) => {
    record[key] = pulled(record[key], condition);
  },
};

function updated(record, update) {
  const next = copyOf(record);
  const isOperator = Object.keys(update).some((key) => key.startsWith('$'));
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
      });
    }
  );
  return next;
}

/**
 * @param {Object} [options]
 * @param {Object} [options.defaults] fields set on insert when absent
 * @param {string[][]} [options.unique] compound unique indexes, eg.
 *   `[['_company', 'name']]`
 * @returns {Object} the model surface, plus `seed`, `all` and `reset` for tests
 */
function fakeCollection({ defaults = {}, unique = [] } = {}) {
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

  function toDocument(record) {
    const document = copyOf(record);
    const data = () => copyOf({ ...document });
    Object.defineProperties(document, {
      id: { get: () => String(document._id) },
      save: {
        value: async () => {
          store(data());
          return document;
        },
      },
      toObject: { value: data },
      toJSON: { value: () => ({ ...data(), id: document.id }) },
      markModified: { value: () => {} },
    });
    return document;
  }

  // Mongoose queries are thenables with a fluent API.
  function query(list, { single = false } = {}) {
    let sortSpec;
    let projection;
    let limit;
    let lean = false;
    const exec = async () => {
      const sorted = sortedBy(sortSpec, list());
      const kept = limit === undefined ? sorted : sorted.slice(0, limit);
      const shaped = kept.map((record) =>
        lean ? copyOf(projected(record, projection)) : toDocument(record)
      );
      return single ? shaped[0] || null : shaped;
    };
    const chain = {
      sort: (spec) => {
        sortSpec = spec;
        return chain;
      },
      select: (spec) => {
        projection = spec;
        return chain;
      },
      limit: (count) => {
        limit = count;
        return chain;
      },
      lean: () => {
        lean = true;
        return chain;
      },
      exec,
      then: (resolve, reject) => exec().then(resolve, reject),
      catch: (reject) => exec().catch(reject),
    };
    return chain;
  }

  function insert(fields) {
    const record = { ...copyOf(defaults), ...copyOf(fields) };
    if (record._id === undefined) record._id = new Types.ObjectId();
    store(record);
    return toDocument(record);
  }

  async function updateFirst(filter, update) {
    const [record] = matching(filter);
    if (!record) return null;
    const next = updated(record, update);
    store(next);
    return next;
  }

  return {
    find: (filter = {}, projection) =>
      query(() => matching(filter)).select(projection),
    findOne: (filter = {}) => query(() => matching(filter), { single: true }),
    findById: (id) => query(() => matching({ _id: id }), { single: true }),
    exists: async (filter = {}) => {
      const [record] = matching(filter);
      return record ? { _id: record._id } : null;
    },
    countDocuments: async (filter = {}) => matching(filter).length,
    create: async (fields) =>
      Array.isArray(fields) ? fields.map(insert) : insert(fields),
    insertMany: async (list) => list.map(insert),
    updateOne: async (filter, update) => {
      const next = await updateFirst(filter, update);
      return { matchedCount: next ? 1 : 0, modifiedCount: next ? 1 : 0 };
    },
    updateMany: async (filter, update) => {
      const found = matching(filter);
      found.forEach((record) => store(updated(record, update)));
      return { matchedCount: found.length, modifiedCount: found.length };
    },
    findOneAndUpdate: async (filter, update) => {
      const next = await updateFirst(filter, update);
      return next && toDocument(next);
    },
    deleteOne: async (filter) => {
      const [record] = matching(filter);
      if (!record) return { deletedCount: 0 };
      records.splice(indexOf(record._id), 1);
      return { deletedCount: 1 };
    },
    deleteMany: async (filter = {}) => {
      const before = records.length;
      records = records.filter((record) => !matches(record, filter));
      return { deletedCount: before - records.length };
    },

    // Test side, not part of a model.
    seed: (list) => list.forEach(insert),
    all: () => records.map(copyOf),
    reset: () => {
      records = [];
    },
  };
}

module.exports = { fakeCollection };
