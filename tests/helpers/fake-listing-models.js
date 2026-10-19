'use strict';

/**
 * In-memory stand-ins for the `Groups`, `Workspaces`, `Folders` and
 * `Mailings` models, for the tests that list emails across locations.
 *
 * There is no test database (see fake-user-models.js for the same choice on
 * users). These fakes answer a query the way Mongoose and MongoDB would, so a
 * test seeds records and reads back what the service answers, whatever query
 * it builds. Where they would differ, they throw rather than answer
 * something MongoDB would not.
 *
 * - **Filters, sort and projection**: as MongoDB reads them, see
 *   fake-mongo-query.js.
 * - **Documents**: a `.lean()` query answers the stored fields only, without
 *   `id`, aliases or virtuals. Otherwise a document has `id`, the `group`
 *   alias on a workspace, and `toObject()` / `toJSON()`.
 * - **Virtual populates**: a workspace's `folders` (every folder pointing at
 *   it, as the schema's virtual declares) and a folder's `childFolders` are
 *   there only when the query populates them, nested populates included.
 * - `Mailings.paginate` answers like mongoose-paginate-v2 (`docs`,
 *   `totalDocs`, `limit`, `page`, `totalPages`, …), with its `page`, `limit`,
 *   `sort`, `pagination: false`, `projection` and `lean` options.
 */

const {
  equals,
  matches,
  sortedBy,
  projected,
} = require('./fake-mongo-query.js');

// `'folders'`, `{ path: 'folders', populate: 'childFolders' }`, or a list.
function populateSpecs(arg) {
  if (!arg) return [];
  if (Array.isArray(arg)) return arg.flatMap(populateSpecs);
  if (typeof arg === 'string') {
    return arg
      .split(/\s+/)
      .filter(Boolean)
      .map((path) => ({ path, populate: [] }));
  }
  return [{ path: arg.path, populate: populateSpecs(arg.populate) }];
}

// Mongoose queries are thenables with a fluent API. `shape` builds the
// answer from the matching records, after the sort, the skip and the limit,
// knowing whether the query is lean and what it populates.
function query(list, shape) {
  let sortSpec;
  let limit;
  let skip = 0;
  let lean = false;
  const populate = [];
  const resolve = () => {
    const sorted = sortedBy(sortSpec, list()).slice(skip);
    return shape(limit === undefined ? sorted : sorted.slice(0, limit), {
      lean,
      populate,
    });
  };
  const chain = {
    populate: (arg) => {
      populate.push(...populateSpecs(arg));
      return chain;
    },
    select: () => chain,
    sort: (spec) => {
      sortSpec = spec;
      return chain;
    },
    skip: (count) => {
      skip = count;
      return chain;
    },
    limit: (count) => {
      limit = count;
      return chain;
    },
    lean: (value = true) => {
      lean = value;
      return chain;
    },
    exec: () => Promise.resolve(resolve()),
    then: (onFulfilled, onRejected) =>
      Promise.resolve().then(resolve).then(onFulfilled, onRejected),
  };
  return chain;
}

// The paths a populate may name that these fakes hold nothing for: the users
// of a workspace stay ids.
const UNHELD_PATHS = ['users', '_users'];

function createListingStore() {
  const groups = [];
  const workspaces = [];
  const folders = [];
  const mailings = [];

  // What a non-lean query answers: `id`, the schema's aliases, and the
  // plain-object methods, which keep the virtuals (`virtuals: true`).
  function hydrated(fields, aliases = {}) {
    const doc = { ...fields, id: String(fields._id) };
    Object.entries(aliases).forEach(([alias, field]) => {
      if (fields[field] !== undefined) doc[alias] = fields[field];
    });
    const plain = () =>
      Object.fromEntries(
        Object.entries(doc).filter(([, value]) => typeof value !== 'function')
      );
    doc.toObject = plain;
    doc.toJSON = plain;
    return doc;
  }

  const VIRTUALS = {
    workspace: {
      folders: (record) =>
        folders.filter((folder) => equals(folder._workspace, record._id)),
    },
    folder: {
      childFolders: (record) =>
        folders.filter((child) => equals(child._parentFolder, record._id)),
    },
  };
  const KIND_OF_VIRTUAL = { folders: 'folder', childFolders: 'folder' };
  const ALIASES = { workspace: { group: '_company' } };

  function documentOf(kind, record, { lean, populate, projection }) {
    if (!record) return null;
    const fields = projected(record, projection);
    populate.forEach(({ path, populate: nested }) => {
      if (UNHELD_PATHS.includes(path)) return;
      const virtual = VIRTUALS[kind] && VIRTUALS[kind][path];
      if (!virtual) {
        throw new Error(`fake models: populating ${kind}.${path}`);
      }
      fields[path] = virtual(record).map((related) =>
        documentOf(KIND_OF_VIRTUAL[path], related, {
          lean,
          populate: nested,
        })
      );
    });
    return lean ? fields : hydrated(fields, ALIASES[kind]);
  }

  function model(kind, records) {
    const found = (filter) => records.filter((r) => matches(r, filter));
    const many = (projection) => (list, options) =>
      list.map((r) => documentOf(kind, r, { ...options, projection }));
    const one = (projection) => (list, options) =>
      documentOf(kind, list[0], { ...options, projection });
    return {
      find: (filter, projection) =>
        query(() => found(filter), many(projection)),
      findOne: (filter, projection) =>
        query(() => found(filter), one(projection)),
      findById: (id, projection) =>
        query(() => found({ _id: id }), one(projection)),
      exists: async (filter) => found(filter).length > 0,
      countDocuments: async (filter) => found(filter).length,
      distinct: async (field, filter) => [
        ...new Set(found(filter).flatMap((r) => [].concat(r[field] ?? []))),
      ],
    };
  }

  const Groups = model('group', groups);
  const Workspaces = model('workspace', workspaces);
  const Folders = model('folder', folders);
  const Mailings = {
    ...model('mailing', mailings),
    // What mongoose-paginate-v2 answers.
    paginate: async (filter, options = {}) => {
      const all = sortedBy(
        options.sort,
        mailings.filter((m) => matches(m, filter))
      );
      const paginated = options.pagination !== false;
      const limit = paginated ? options.limit ?? 10 : all.length;
      const page = paginated ? options.page ?? 1 : 1;
      const start = (page - 1) * limit;
      const docs = all
        .slice(start, paginated ? start + limit : undefined)
        .map((m) =>
          documentOf('mailing', m, {
            lean: !!options.lean,
            populate: [],
            projection: options.projection,
          })
        );
      const totalPages = limit ? Math.max(1, Math.ceil(all.length / limit)) : 1;
      return {
        docs,
        totalDocs: all.length,
        limit,
        page,
        totalPages,
        pagingCounter: start + 1,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
      };
    },
  };

  // Records are stored as given: a field left out is missing, a `null` is
  // stored, as a move writes it.
  function seed({
    groups: g = [],
    workspaces: w = [],
    folders: f = [],
    mailings: m = [],
  }) {
    [groups, workspaces, folders, mailings].forEach((list) => {
      list.length = 0;
    });
    groups.push(...g.map((r) => ({ ...r })));
    workspaces.push(...w.map((r) => ({ _users: [], ...r })));
    folders.push(...f.map((r) => ({ ...r })));
    mailings.push(...m.map((r) => ({ tags: [], ...r })));
  }

  return { Groups, Workspaces, Folders, Mailings, seed };
}

module.exports = { createListingStore };
