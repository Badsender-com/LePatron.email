'use strict';

/**
 * In-memory stand-ins for the `Groups`, `Workspaces`, `Folders` and
 * `Mailings` models, for the tests that list emails across locations.
 *
 * There is no test database (see fake-user-models.js for the same choice on
 * users). These fakes honour a filter the way MongoDB would, so a test seeds
 * records and reads back what the service answers, whatever query it builds:
 * equality on ids and values (an array field matches one of its elements),
 * `$in`, `$nin`, `$ne`, `$exists`, `$gt`, `$gte`, `$lt`, `$lte`, `$regex`
 * with `$options`, `$or` and `$and`.
 *
 * `Mailings.paginate` answers like mongoose-paginate-v2 (`docs`, `totalDocs`,
 * `limit`, `page`, `totalPages`, …), with its `page`, `limit`, `sort`,
 * `pagination: false` and `projection` options. Documents carry `id` and the
 * virtuals the services read: `group` on a workspace, `folders` (its root
 * folders) on a workspace, `childFolders` on a folder.
 */

const isPlainObject = (value) =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !(value instanceof RegExp) &&
  !value._bsontype;

// What a stored value compares as: a date by its time, an id by its hex.
function comparable(value) {
  if (value instanceof Date) return value.getTime();
  if (value === undefined || value === null) return value;
  if (typeof value === 'number') return value;
  return String(value);
}

function equals(actual, expected) {
  if (Array.isArray(actual)) {
    return actual.some((element) => equals(element, expected));
  }
  if (actual === undefined || actual === null) {
    return expected === undefined || expected === null;
  }
  return comparable(actual) === comparable(expected);
}

const ORDER = {
  $gt: (a, b) => a > b,
  $gte: (a, b) => a >= b,
  $lt: (a, b) => a < b,
  $lte: (a, b) => a <= b,
};

function matchesCondition(actual, condition) {
  if (condition instanceof RegExp) {
    return typeof actual === 'string' && condition.test(actual);
  }
  if (!isPlainObject(condition)) return equals(actual, condition);
  return Object.entries(condition).every(([operator, operand]) => {
    switch (operator) {
      case '$in':
        return operand.some((value) => equals(actual, value));
      case '$nin':
        return !operand.some((value) => equals(actual, value));
      case '$ne':
        return !equals(actual, operand);
      case '$exists':
        return operand
          ? actual !== undefined && actual !== null
          : actual === undefined || actual === null;
      case '$regex':
        return (
          typeof actual === 'string' &&
          new RegExp(operand, condition.$options || '').test(actual)
        );
      case '$options':
        return true;
      default:
        if (ORDER[operator]) {
          return (
            actual !== undefined &&
            actual !== null &&
            ORDER[operator](comparable(actual), comparable(operand))
          );
        }
        throw new Error(`fake models: ${operator} is not supported`);
    }
  });
}

function matches(record, filter = {}) {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$or') return condition.some((part) => matches(record, part));
    if (key === '$and') return condition.every((part) => matches(record, part));
    return matchesCondition(record[key], condition);
  });
}

// Orders like MongoDB's `sort`: binary order of the values, so uppercase
// sorts before lowercase.
function sortedBy(spec, list) {
  if (!spec) return list;
  const keys = Object.entries(spec);
  const compare = (a, b) => {
    const left = comparable(a);
    const right = comparable(b);
    if (left === right) return 0;
    if (left === undefined || left === null) return -1;
    if (right === undefined || right === null) return 1;
    return left < right ? -1 : 1;
  };
  return [...list].sort((a, b) => {
    for (const [key, direction] of keys) {
      const order = compare(a[key], b[key]);
      if (order !== 0) return order * (Number(direction) < 0 ? -1 : 1);
    }
    return 0;
  });
}

// A find projection: `1` keeps a field, `'$field'` copies another one, `0`
// drops it. `_id` is always kept.
function projected(record, projection) {
  if (!projection) return { ...record };
  const entries = Object.entries(projection);
  if (entries.every(([, value]) => value === 0)) {
    const copy = { ...record };
    entries.forEach(([key]) => delete copy[key]);
    return copy;
  }
  const copy = { _id: record._id };
  entries.forEach(([key, value]) => {
    if (value === 1 && record[key] !== undefined) copy[key] = record[key];
    if (typeof value === 'string' && value.startsWith('$')) {
      copy[key] = record[value.slice(1)];
    }
  });
  return copy;
}

// Mongoose queries are thenables with a fluent API.
function query(list, shape) {
  let sortSpec;
  let limit;
  let skip = 0;
  const resolve = () => {
    const sorted = sortedBy(sortSpec, list()).slice(skip);
    return shape(limit === undefined ? sorted : sorted.slice(0, limit));
  };
  const chain = {
    populate: () => chain,
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
    lean: () => chain,
    exec: () => Promise.resolve(resolve()),
    then: (onFulfilled, onRejected) =>
      Promise.resolve().then(resolve).then(onFulfilled, onRejected),
  };
  return chain;
}

function createListingStore() {
  const groups = [];
  const workspaces = [];
  const folders = [];
  const mailings = [];

  const withId = (record) => ({
    ...record,
    id: String(record._id),
    toObject() {
      return { ...this };
    },
    toJSON() {
      return { ...this };
    },
  });

  const folderDocument = (record) =>
    record && {
      ...withId(record),
      childFolders: folders
        .filter((child) => equals(child._parentFolder, record._id))
        .map(withId),
    };

  const workspaceDocument = (record) =>
    record && {
      ...withId(record),
      group: record._company,
      folders: folders
        .filter((folder) => equals(folder._workspace, record._id))
        .map(folderDocument),
    };

  function model(records, toDocument) {
    const found = (filter) => records.filter((r) => matches(r, filter));
    return {
      find: (filter, projection) =>
        query(
          () => found(filter),
          (list) => list.map((r) => toDocument(projected(r, projection)))
        ),
      findOne: (filter) =>
        query(
          () => found(filter),
          (list) => toDocument(list[0]) || null
        ),
      findById: (id) =>
        query(
          () => found({ _id: id }),
          (list) => toDocument(list[0]) || null
        ),
      exists: async (filter) => found(filter).length > 0,
      countDocuments: async (filter) => found(filter).length,
      distinct: async (field, filter) => [
        ...new Set(found(filter).flatMap((r) => [].concat(r[field] ?? []))),
      ],
    };
  }

  const Groups = model(groups, (r) => r && withId(r));
  const Workspaces = model(workspaces, workspaceDocument);
  const Folders = model(folders, folderDocument);
  const Mailings = {
    ...model(mailings, (r) => r && withId(r)),
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
        .map((m) => projected(m, options.projection));
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

module.exports = { createListingStore, matches };
