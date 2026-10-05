'use strict';

/**
 * In-memory stand-ins for the `Users`, `Groups` and `Mailings` models.
 *
 * There is no test database, so controller tests mock Mongoose at the model
 * boundary. A `jest.fn()` per method would make every test restate which
 * query the implementation runs; these fakes instead honour the filter the
 * way MongoDB would (`_id`, `_company`, `role`, `email`, `isDeactivated`,
 * with `$ne`, `$in`, `$exists`), so a test only seeds records and reads them
 * back through the controller.
 *
 * Documents carry the virtuals and methods the controllers rely on:
 * `isAdmin` and `isGroupAdmin` derive from `role` as `UserSchema` does once
 * super admin is a persisted role (ADR 0002); `activate`, `deactivate`,
 * `resetPassword` and `save` write back to the store.
 */

const ROLE_SUPER_ADMIN = 'super_admin';
const ROLE_COMPANY_ADMIN = 'company_admin';

function matchesValue(actual, expected) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if ('$ne' in expected) return !matchesValue(actual, expected.$ne);
    if ('$in' in expected) {
      return expected.$in.some((value) => matchesValue(actual, value));
    }
    if ('$exists' in expected) {
      return expected.$exists ? actual !== undefined : actual === undefined;
    }
  }
  if (actual === undefined && expected === undefined) return true;
  return String(actual) === String(expected);
}

function matches(record, filter = {}) {
  return Object.entries(filter).every(([key, expected]) =>
    matchesValue(record[key], expected)
  );
}

// Mongoose queries are thenables with a fluent API; the controllers chain
// `populate`, `select`, `sort` and `lean` before awaiting.
function query(resolveTo) {
  const chain = {
    populate: () => chain,
    select: () => chain,
    sort: () => chain,
    lean: () => chain,
    exec: () => Promise.resolve(resolveTo()),
    then: (onFulfilled, onRejected) =>
      Promise.resolve().then(resolveTo).then(onFulfilled, onRejected),
  };
  return chain;
}

function createStore() {
  const users = [];
  const groups = [];

  function groupOf(record) {
    const group = groups.find((candidate) =>
      matchesValue(candidate._id, record._company)
    );
    return group ? { ...group, id: String(group._id) } : record._company;
  }

  function toDocument(record, { populated } = {}) {
    if (!record) return null;
    const doc = {
      ...record,
      id: String(record._id),
      get isAdmin() {
        return this.role === ROLE_SUPER_ADMIN;
      },
      get isGroupAdmin() {
        return this.role === ROLE_COMPANY_ADMIN;
      },
      get group() {
        return groupOf(this);
      },
      async save() {
        Object.assign(
          record,
          Object.fromEntries(
            Object.entries(this).filter(
              ([key, value]) => typeof value !== 'function' && key !== 'id'
            )
          )
        );
        return this;
      },
      async activate() {
        this.isDeactivated = false;
        return this.save();
      },
      async deactivate() {
        this.password = undefined;
        this.token = undefined;
        this.isDeactivated = true;
        return this.save();
      },
      async resetPassword() {
        this.password = undefined;
        this.token = 'reset-token';
        return this.save();
      },
      toJSON() {
        const fields = Object.fromEntries(
          Object.entries(this).filter(
            ([, value]) => typeof value !== 'function'
          )
        );
        return {
          ...fields,
          isAdmin: this.isAdmin,
          isGroupAdmin: this.isGroupAdmin,
        };
      },
    };
    if (populated) doc._company = groupOf(record);
    return doc;
  }

  const Users = {
    find: (filter) =>
      query(() =>
        users.filter((u) => matches(u, filter)).map((u) => toDocument(u))
      ),
    findOne: (filter) =>
      query(() => toDocument(users.find((u) => matches(u, filter)))),
    findById: (id) =>
      query(() => toDocument(users.find((u) => matches(u, { _id: id })))),
    findOneForApi: async (filter) =>
      toDocument(
        users.find((u) => matches(u, filter)),
        { populated: true }
      ),
    countDocuments: async (filter) =>
      users.filter((u) => matches(u, filter)).length,
    create: async (fields) => {
      const record = { _id: nextId(), isDeactivated: false, ...fields };
      users.push(record);
      return toDocument(record);
    },
    findByIdAndUpdate: (id, update) =>
      query(() => {
        const record = users.find((u) => matches(u, { _id: id }));
        if (!record) return null;
        const fields = update.$set || update;
        Object.entries(fields).forEach(([key, value]) => {
          if (value !== undefined) record[key] = value;
        });
        return toDocument(record, { populated: true });
      }),
    updateOne: async (filter, update) => {
      const record = users.find((u) => matches(u, filter));
      if (record) Object.assign(record, update.$set || update);
      return { nModified: record ? 1 : 0 };
    },
  };

  const Groups = {
    findById: (id) =>
      query(() => groups.find((g) => matches(g, { _id: id })) || null),
    findOne: (filter) =>
      query(() => groups.find((g) => matches(g, filter)) || null),
    find: (filter) => query(() => groups.filter((g) => matches(g, filter))),
  };

  const Mailings = {
    updateMany: async () => ({ nModified: 0 }),
  };

  let counter = 0;
  function nextId() {
    counter += 1;
    return `6f${String(counter).padStart(22, '0')}`;
  }

  function seed({ users: userRecords = [], groups: groupRecords = [] }) {
    users.length = 0;
    groups.length = 0;
    userRecords.forEach((u) => users.push({ isDeactivated: false, ...u }));
    groupRecords.forEach((g) => groups.push({ ...g }));
  }

  function userRecord(id) {
    return users.find((u) => matches(u, { _id: id })) || null;
  }

  return { Users, Groups, Mailings, seed, userRecord };
}

module.exports = { createStore };
