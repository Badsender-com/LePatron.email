'use strict';

/**
 * In-memory stand-ins for the models the MCP server reads, for its acceptance
 * tests (epic #1290). There is no test database: like fake-listing-models.js,
 * these answer a query the way Mongoose and MongoDB would (filters, sort and
 * projection through fake-mongo-query.js), so a test seeds records and reads
 * back what the MCP server answers, whatever query it builds.
 *
 * - A `.lean()` query answers copies of the stored fields; otherwise a
 *   document also has `id`, `toObject()` / `toJSON()`, and `save()`, which
 *   stores its fields back, unless it was read with a projection. As
 *   Mongoose does, an array the document only added elements to since it
 *   was read is pushed to, so two documents read at once that each add one
 *   keep both; any other field is set as the document holds it. A
 *   condition set on the document (`doc.$where`) is checked against the
 *   stored record first: a record it does not match is not found, as
 *   Mongoose's DocumentNotFoundError.
 * - `create(record)` stores a copy, with an `_id` when it has none.
 * - `validate()` runs no schema: the hooks are tested on the real schemas
 *   (tests/server/ai-skill/models/).
 * - A query's `cursor()` yields its documents to a `for await`.
 * - `bulkWrite` takes `updateOne` operations of a `$set` only.
 * - `updateMany` takes a `$set` only; `findOneAndUpdate` a `$set` and a
 *   `$push`, and answers the document before the update, or after it with
 *   `{ new: true }`, or null when nothing matches. A `$set` of `array.$`
 *   replaces the first element the filter's `$elemMatch` on that array
 *   matches, each field compared as MongoDB does (a date by its time), as
 *   the positional operator does; any other positional path throws.
 * - `populate` is not supported: it throws, rather than answer a document
 *   MongoDB would have filled.
 * - `aggregate` answers plain copies, as Mongoose does, through the stages
 *   fake-mongo-aggregate.js reads.
 * - Each collection the seed names is a model; the others are empty.
 * - `paginate` answers like mongoose-paginate-v2, as fake-listing-models.js
 *   does, and counts as it does, with or without pagination: through the
 *   caller's `useCustomCountFn`, or else `countDocuments`. The schema's own
 *   `findForApiWithPagination` runs over it: the search across workspaces
 *   (ADR 0007) runs as in the app.
 * - A query takes `maxTimeMS`, and never runs out of its time.
 * - `Comments.findApprovedMailingIds` is the schema's own static, an
 *   aggregation over the fake comments, and the fake `Comments` is the
 *   `Comment` model Mongoose knows: the listing reads the approval of each
 *   mailing by the app's own rule. An aggregation casts nothing, as in
 *   MongoDB: a string never finds a reference stored as an ObjectId, as the
 *   fixtures store a comment's mailing, so the ids it is given must be
 *   ObjectIds. Most other ids are stored as their hex string, which a find
 *   matches as Mongoose casts it; only a lean page of `paginate` answers its
 *   `_id` as an ObjectId.
 * - A copy keeps an ObjectId an ObjectId.
 */

const { isDeepStrictEqual } = require('util');
const mongoose = require('mongoose');
const { matches, sortedBy, projected } = require('./fake-mongo-query.js');
const { aggregated } = require('./fake-mongo-aggregate.js');
const MailingSchema = require('../../packages/server/mailing/mailing.schema.js');
const {
  CommentSchema,
} = require('../../packages/server/comment/comment.schema.js');
const {
  CommentModel,
} = require('../../packages/server/constant/model.names.js');

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
  feedbacks: 'McpFeedbacks',
  // The retex loop (ADR 0021).
  retex: 'McpRetexes',
  callLogs: 'McpCallLogs',
  clients: 'McpClients',
  connections: 'McpConnections',
  securityEvents: 'SecurityEvents',
  taxonomyItems: 'TaxonomyItems',
  // A copy following production (ADR 0019).
  readTokens: 'SkillsReadTokens',
  follows: 'SkillsFollows',
};

// An ObjectId once `structuredClone` copied it: its fields, not its class.
const isClonedObjectId = (value) =>
  !!value &&
  typeof value === 'object' &&
  !(value instanceof mongoose.Types.ObjectId) &&
  /^ObjectI[dD]$/.test(value._bsontype || '') &&
  !!value.id;

// The ObjectIds of a fresh copy made ObjectIds again, in place: a stored
// reference keeps its hex, and its comparison with an id. Plain objects and
// arrays are walked, whatever realm built them.
function revived(value) {
  if (isClonedObjectId(value)) {
    return mongoose.Types.ObjectId(Buffer.from(value.id).toString('hex'));
  }
  if (Array.isArray(value)) {
    value.forEach((element, index) => {
      value[index] = revived(element);
    });
  } else if (Object.prototype.toString.call(value) === '[object Object]') {
    Object.keys(value).forEach((key) => {
      value[key] = revived(value[key]);
    });
  }
  return value;
}

// Node 17+, given to the test files by node-globals-environment.js.
/* global structuredClone */
const copy = (record) => revived(structuredClone(record));

// What Mongoose answers of an id stored as an ObjectId; the fixtures store
// most ids as their hex string.
const HEX_ID = /^[0-9a-f]{24}$/i;
const asObjectId = (id) =>
  typeof id === 'string' && HEX_ID.test(id) ? mongoose.Types.ObjectId(id) : id;

// The fields of a document, without what the fakes add to it.
function fieldsOf(doc) {
  const { id: _addedId, $where: _condition, ...fields } = doc;
  return copy(fields);
}

// What a save writes back to the record: an array the document only added
// elements to since `read` is pushed to; any other field is set.
function saveInto(stored, fields, read) {
  Object.keys(stored).forEach((key) => {
    if (!(key in fields)) delete stored[key];
  });
  Object.entries(fields).forEach(([key, value]) => {
    const before = read[key];
    const pushedOnly =
      Array.isArray(value) &&
      Array.isArray(before) &&
      Array.isArray(stored[key]) &&
      value.length > before.length &&
      isDeepStrictEqual(value.slice(0, before.length), before);
    if (pushedOnly) stored[key].push(...value.slice(before.length));
    else stored[key] = value;
  });
}

// `stored` is the record itself, which `save` writes back to; none for a
// document read with a projection, which has only some of its fields.
function toDocument(record, stored) {
  const read = copy(record);
  const doc = { ...copy(record), id: String(record._id) };
  Object.defineProperty(doc, 'toObject', { value: () => fieldsOf(doc) });
  Object.defineProperty(doc, 'toJSON', { value: () => ({ ...doc }) });
  Object.defineProperty(doc, 'validate', { value: async () => undefined });
  Object.defineProperty(doc, 'save', {
    value: async () => {
      if (!stored) {
        throw new Error('fake MCP models: save of a projected document');
      }
      // A condition set on the document, as Mongoose's `doc.$where`: a
      // stored record it no longer matches is not found.
      if (doc.$where && !matches(stored, doc.$where)) {
        throw Object.assign(new Error('No document found'), {
          name: 'DocumentNotFoundError',
        });
      }
      saveInto(stored, fieldsOf(doc), read);
      return doc;
    },
  });
  return doc;
}

// `array.$`: the element of `array` the filter's `$elemMatch` matched.
function setPositional(record, path, value, filter) {
  const field = path.slice(0, -2);
  const condition = filter[field] && filter[field].$elemMatch;
  if (path !== `${field}.$` || field.includes('.') || !condition) {
    throw new Error(`fake MCP models: the positional path ${path}`);
  }
  const index = (record[field] || []).findIndex((element) =>
    matches(element, condition)
  );
  record[field][index] = copy(value);
}

// `{ $set, $push }`, as findOneAndUpdate takes them.
function applyUpdate(record, update, filter) {
  const { $set = {}, $push = {}, ...others } = update;
  if (Object.keys(others).length) {
    throw new Error(
      `fake MCP models: ${Object.keys(others).join(', ')} is not supported`
    );
  }
  Object.entries($set).forEach(([path, value]) => {
    if (path.includes('$')) setPositional(record, path, value, filter);
    else record[path] = copy(value);
  });
  Object.entries($push).forEach(([key, value]) => {
    record[key] = [...(record[key] || []), copy(value)];
  });
}

let nextId = 0;
const newId = () =>
  (0x6000000000 + (nextId += 1)).toString(16).padStart(24, '0');

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
    return shape(
      page.map((record) => {
        if (selectSpec) {
          const shaped = projected(record, selectSpec);
          return lean ? copy(shaped) : toDocument(shaped);
        }
        return lean ? copy(record) : toDocument(record, record);
      })
    );
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
    // No query runs out of its time here.
    maxTimeMS() {
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
    // What a Mongoose cursor gives a `for await`: the documents, one by one.
    cursor: () => ({
      async *[Symbol.asyncIterator]() {
        yield* await Promise.resolve().then(resolve);
      },
    }),
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
    create: async (record) => {
      const stored = { _id: newId(), ...copy(record) };
      records.push(stored);
      return toDocument(stored, stored);
    },
    // `$set` only; answered as Mongoose 5 does.
    updateOne: async (filter, { $set = {} } = {}) => {
      const record = records.find((candidate) => matches(candidate, filter));
      if (record) Object.assign(record, copy($set));
      const n = record ? 1 : 0;
      return { n, nModified: n, ok: 1 };
    },
    deleteMany: async (filter = {}) => {
      const kept = records.filter((record) => !matches(record, filter));
      const deletedCount = records.length - kept.length;
      records.splice(0, Infinity, ...kept);
      return { deletedCount };
    },
    deleteOne: async (filter = {}) => {
      const index = records.findIndex((record) => matches(record, filter));
      if (index !== -1) records.splice(index, 1);
      return { deletedCount: index === -1 ? 0 : 1 };
    },
    countDocuments: (filter = {}) =>
      query(matching(filter), (docs) => docs.length),
    // A boolean, as Mongoose 5 answers it.
    exists: (filter = {}) => Promise.resolve(matching(filter)().length > 0),
    // What mongoose-paginate-v2 answers, with the options the search passes,
    // counted through the caller's count when it gives one.
    async paginate(filter, options = {}) {
      const all = sortedBy(options.sort, matching(filter)());
      const paginated = options.pagination !== false;
      // mongoose-paginate-v2 1.5 counts every time, a page or not.
      const totalDocs = await (typeof options.useCustomCountFn === 'function'
        ? options.useCustomCountFn()
        : this.countDocuments(filter).exec());
      const limit = paginated ? options.limit ?? 10 : all.length;
      const page = paginated ? options.page ?? 1 : 1;
      const start = (page - 1) * limit;
      const records = all.slice(start, paginated ? start + limit : undefined);
      const docs = records.map((record) =>
        projected(copy(record), options.projection)
      );
      const totalPages = limit ? Math.max(1, Math.ceil(all.length / limit)) : 1;
      return {
        // A lean document's `_id` is an ObjectId, as Mongoose answers it,
        // whatever the fixtures stored: the listing's aggregations match it
        // against the references the comments store. A document read with a
        // projection has only some of its fields: it is not saved back.
        docs: options.lean
          ? docs.map((doc) => ({ ...doc, _id: asObjectId(doc._id) }))
          : docs.map((doc, index) =>
              toDocument(doc, options.projection ? undefined : records[index])
            ),
        totalDocs,
        limit,
        page,
        totalPages,
      };
    },
    // A record without the field gives no value.
    distinct: (field, filter = {}) =>
      Promise.resolve([
        ...new Set(
          matching(filter)()
            .flatMap((record) => record[field])
            .filter((value) => value !== undefined)
        ),
      ]),
    findOneAndUpdate: (filter, update, options = {}) =>
      query(
        () => {
          const [record] = matching(filter)();
          if (!record) return [];
          const before = copy(record);
          applyUpdate(record, update, filter);
          return [options.new ? record : before];
        },
        (docs) => docs[0] || null
      ),
    // `updateOne` operations of a `$set` only.
    bulkWrite: (operations) =>
      Promise.resolve().then(() => {
        operations.forEach(({ updateOne, ...others }) => {
          const { $set, ...rest } = (updateOne && updateOne.update) || {};
          if (!$set || Object.keys(rest).length || Object.keys(others).length) {
            throw new Error('fake MCP models: bulkWrite takes updateOne $set');
          }
          const [record] = matching(updateOne.filter)();
          if (record) Object.assign(record, copy($set));
        });
        return { nModified: operations.length };
      }),
    updateMany: (filter, update) =>
      Promise.resolve().then(() => {
        const { $set, ...others } = update;
        if (!$set || Object.keys(others).length) {
          throw new Error('fake MCP models: updateMany takes a $set only');
        }
        const found = matching(filter)();
        found.forEach((record) => Object.assign(record, copy($set)));
        return { n: found.length, nModified: found.length };
      }),
    aggregate: (pipeline) =>
      Promise.resolve().then(() => aggregated(records, pipeline).map(copy)),
  };
}

function createMcpStore() {
  const collections = {};
  const models = {};
  Object.entries(MODELS).forEach(([collection, name]) => {
    collections[collection] = [];
    models[name] = model(collections[collection]);
  });
  models.Mailings.findForApiWithPagination =
    MailingSchema.statics.findForApiWithPagination;
  models.Comments.findApprovedMailingIds =
    CommentSchema.statics.findApprovedMailingIds;
  // What the listing reads the comments through (mailing.schema.js), in this
  // test file's own Mongoose.
  mongoose.models[CommentModel] = models.Comments;

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

    // What a collection holds, as copies: for what no MCP client can read.
    stored(collection) {
      return collections[collection].map(copy);
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
