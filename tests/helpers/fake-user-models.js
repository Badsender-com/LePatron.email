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
 * They are filters, not the schema: no validation runs (the enum is covered
 * by `user.schema.test.js`), `findByIdAndUpdate` hands back the updated
 * record, and fields are stored as given.
 *
 * Documents carry the virtuals and methods the controllers rely on. They
 * assume ADR 0002, not today's schema: `isAdmin` and `isGroupAdmin` derive
 * from `role` (the schema suite is what pins the flip of the virtual);
 * `status` follows the schema's virtual without its SAML branch; `activate`,
 * `deactivate`, `resetPassword` and `save` write back to the store.
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

const VIRTUALS = ['isAdmin', 'isGroupAdmin', 'group', 'status'];
// What an update may write, as `UserSchema` declares it.
const STORED_FIELDS = [
  'name',
  'email',
  'lang',
  'role',
  'externalUsername',
  '_company',
  'password',
  'token',
  'tokenExpire',
  'isDeactivated',
  'activeSessionId',
  'sessionMetadata',
  'lastActivity',
];
const isVirtual = (key) => VIRTUALS.includes(key);

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
      get status() {
        if (this.isDeactivated) return 'deactivated';
        if (this.password) return 'confirmed';
        if (this.token) return 'password-mail-sent';
        return 'to-be-initialized';
      },
      async save() {
        // Only stored fields go back to the record: no methods, no virtuals.
        Object.assign(
          record,
          Object.fromEntries(
            Object.entries(this).filter(
              ([key, value]) =>
                typeof value !== 'function' && key !== 'id' && !isVirtual(key)
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
        return Object.fromEntries(
          Object.entries(this).filter(
            ([, value]) => typeof value !== 'function'
          )
        );
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
          if (value !== undefined && STORED_FIELDS.includes(key)) {
            record[key] = value;
          }
        });
        return toDocument(record, { populated: true });
      }),
    updateOne: async (filter, update) => {
      const record = users.find((u) => matches(u, filter));
      if (record) Object.assign(record, update.$set || update);
      return { nModified: record ? 1 : 0 };
    },
  };

  function toGroupDocument(record) {
    if (!record) return null;
    return {
      ...record,
      id: String(record._id),
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
      toJSON() {
        return Object.fromEntries(
          Object.entries(this).filter(
            ([, value]) => typeof value !== 'function'
          )
        );
      },
    };
  }

  const Groups = {
    findById: (id) =>
      query(() => toGroupDocument(groups.find((g) => matches(g, { _id: id })))),
    findOne: (filter) =>
      query(() => toGroupDocument(groups.find((g) => matches(g, filter)))),
    find: (filter) =>
      query(() =>
        groups.filter((g) => matches(g, filter)).map(toGroupDocument)
      ),
    updateMany: async (filter, update) => {
      const targets = groups.filter((g) => matches(g, filter));
      targets.forEach((g) => Object.assign(g, update.$set || update));
      return { nModified: targets.length };
    },
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
