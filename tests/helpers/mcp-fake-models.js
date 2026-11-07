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
 *   stores its fields back, unless it was read with a projection.
 * - `create(record)` stores a copy, with an `_id` when it has none.
 * - `updateMany` takes a `$set` only.
 * - `populate` is not supported: it throws, rather than answer a document
 *   MongoDB would have filled.
 * - `aggregate` answers plain copies, as Mongoose does, through the stages
 *   fake-mongo-aggregate.js reads.
 * - Each collection the seed names is a model; the others are empty.
 * - `paginate` answers like mongoose-paginate-v2, as fake-listing-models.js
 *   does, and `Mailings.findForApiWithPagination` is the schema's own static
 *   over it: the search across workspaces (ADR 0007) runs as in the app.
 */

const { matches, sortedBy, projected } = require('./fake-mongo-query.js');
const { aggregated } = require('./fake-mongo-aggregate.js');
const MailingSchema = require('../../packages/server/mailing/mailing.schema.js');

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
  taxonomyItems: 'TaxonomyItems',
  // A copy following production (ADR 0019).
  readTokens: 'SkillsReadTokens',
  follows: 'SkillsFollows',
};

// Node 17+, given to the test files by node-globals-environment.js.
/* global structuredClone */
const copy = (record) => structuredClone(record);

// The fields of a document, without what the fakes add to it.
function fieldsOf(doc) {
  const { id: _addedId, ...fields } = doc;
  return copy(fields);
}

// `stored` is the record itself, which `save` writes back to; none for a
// document read with a projection, which has only some of its fields.
function toDocument(record, stored) {
  const doc = { ...copy(record), id: String(record._id) };
  Object.defineProperty(doc, 'toObject', { value: () => fieldsOf(doc) });
  Object.defineProperty(doc, 'toJSON', { value: () => ({ ...doc }) });
  Object.defineProperty(doc, 'save', {
    value: async () => {
      if (!stored) {
        throw new Error('fake MCP models: save of a projected document');
      }
      Object.keys(stored).forEach((key) => delete stored[key]);
      Object.assign(stored, fieldsOf(doc));
      return doc;
    },
  });
  return doc;
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
    countDocuments: (filter = {}) => Promise.resolve(matching(filter)().length),
    // What mongoose-paginate-v2 answers, with the options the search passes.
    paginate: async (filter, options = {}) => {
      const all = sortedBy(options.sort, matching(filter)());
      const paginated = options.pagination !== false;
      const limit = paginated ? options.limit ?? 10 : all.length;
      const page = paginated ? options.page ?? 1 : 1;
      const start = (page - 1) * limit;
      const records = all.slice(start, paginated ? start + limit : undefined);
      const docs = records.map((record) =>
        projected(copy(record), options.projection)
      );
      const totalPages = limit ? Math.max(1, Math.ceil(all.length / limit)) : 1;
      return {
        // A document read with a projection has only some of its fields: it
        // is not saved back.
        docs: options.lean
          ? docs
          : docs.map((doc, index) =>
              toDocument(doc, options.projection ? undefined : records[index])
            ),
        totalDocs: all.length,
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
  // The app's approval rule, an aggregation the fakes do not run, written
  // the way it reads (comment.schema.js): the latest root comment not
  // deleted decides, `isDeleted: false` as the schema stores it.
  models.Comments.findApprovedMailingIds = async (mailingIds) => {
    const wanted = new Set(mailingIds.map(String));
    const latest = new Map();
    sortedBy(
      { createdAt: -1 },
      collections.comments.filter(
        (comment) =>
          wanted.has(String(comment._mailing)) &&
          !comment._parentComment &&
          comment.isDeleted === false
      )
    ).forEach((comment) => {
      const id = String(comment._mailing);
      if (!latest.has(id)) latest.set(id, comment.decision);
    });
    return [...latest]
      .filter(([, decision]) => decision === 'approved')
      .map(([id]) => id);
  };

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
