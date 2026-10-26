'use strict';

// The reach of user management: a company admin manages the accounts of
// their own group, an admin manages every account. Specified at the
// controller, with the authenticated user as passport puts it on the request
// and the models replaced by an in-memory store.

jest.mock('../../../packages/server/common/models.common.js', () => {
  const users = [];
  const matches = (record, filter) =>
    Object.entries(filter).every(
      ([key, value]) => String(record[key]) === String(value)
    );
  const chain = (resolveTo) => {
    const query = {
      select: () => query,
      populate: () => query,
      skip: () => query,
      limit: () => query,
      then: (ok, ko) => Promise.resolve().then(resolveTo).then(ok, ko),
    };
    return query;
  };
  const toDocument = (record) =>
    record && {
      ...record,
      id: String(record._id),
      group: { id: String(record._company) },
      async activate() {
        record.isDeactivated = false;
      },
      async deactivate() {
        record.isDeactivated = true;
      },
      async resetPassword() {
        record.token = 'reset';
      },
    };
  return {
    Users: {
      __records: users,
      findOneForApi: async (filter) =>
        toDocument(users.find((u) => matches(u, filter))),
      findById: (id) =>
        chain(() => toDocument(users.find((u) => matches(u, { _id: id })))),
      findByIdAndUpdate: (id, update) =>
        chain(() => {
          const record = users.find((u) => matches(u, { _id: id }));
          Object.assign(record, update);
          return toDocument(record);
        }),
      // Deactivating forgets the trusted devices (ADR 0008).
      updateOne: async () => ({ modifiedCount: 1 }),
      create: async (fields) => {
        const record = { _id: `created-${users.length}`, ...fields };
        users.push(record);
        return toDocument(record);
      },
    },
    Mailings: {
      updateMany: async () => ({ nModified: 0 }),
      find: () => chain(() => []),
      countDocuments: async () => 0,
    },
    // No group has SSO here (account/sso-member.js).
    Groups: { findOne: async () => null },
  };
});
jest.mock('../../../packages/server/group/group.service.js', () => ({
  findById: async (groupId) => ({ _id: groupId }),
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { Users } = require('../../../packages/server/common/models.common.js');
const controller = require('../../../packages/server/user/user.controller.js');

const GROUP_A = '507f1f77bcf86cd799439a01';
const GROUP_B = '507f1f77bcf86cd799439b01';
const CAROL = '507f1f77bcf86cd799439103'; // company admin of A
const DAVE = '507f1f77bcf86cd799439104'; // regular user of A
const FRANK = '507f1f77bcf86cd799439106'; // regular user of B
const TINA = '507f1f77bcf86cd799439107'; // tech admin of A

const RECORDS = [
  { _id: CAROL, name: 'Carol', role: 'company_admin', _company: GROUP_A },
  { _id: DAVE, name: 'Dave', role: 'regular_user', _company: GROUP_A },
  { _id: FRANK, name: 'Frank', role: 'regular_user', _company: GROUP_B },
  {
    _id: TINA,
    name: 'Tina',
    email: 'tina@a.test',
    role: 'company_admin_tech',
    _company: GROUP_A,
  },
];

// As passport puts it on the request: the stored user's JSON, whose
// populated company carries `id` but no `_id`.
const companyAdminOfA = {
  id: CAROL,
  role: 'company_admin',
  _company: { id: GROUP_A, name: 'A' },
  group: { id: GROUP_A, name: 'A' },
};
const admin = { id: 'admin', role: 'super_admin' };

function call(handler, { user, params = {}, body = {}, query = {} }) {
  return new Promise((resolve) => {
    const res = {
      json: (payload) => resolve({ status: 200, body: payload }),
    };
    handler({ user, params, body, query }, res, (err) =>
      resolve({ status: err.status, error: err.message })
    );
  });
}

const REFUSED = { status: 403, error: 'FORBIDDEN_USER_ACCESS' };

beforeEach(() => {
  Users.__records.length = 0;
  RECORDS.forEach((r) => Users.__records.push({ ...r }));
});

// The actions a company admin runs on another account of their group.
const MANAGEMENT_ACTIONS = [
  [
    'reads',
    (u, id) => call(controller.read, { user: u, params: { userId: id } }),
  ],
  [
    'updates',
    (u, id) =>
      call(controller.update, {
        user: u,
        params: { userId: id },
        body: { name: 'Renamed' },
      }),
  ],
  [
    'activates',
    (u, id) => call(controller.activate, { user: u, params: { userId: id } }),
  ],
  [
    'deactivates',
    (u, id) => call(controller.deactivate, { user: u, params: { userId: id } }),
  ],
  [
    'resets the password of',
    (u, id) =>
      call(controller.adminResetPassword, {
        user: u,
        params: { userId: id },
      }),
  ],
  [
    'lists the mailings of',
    (u, id) =>
      call(controller.readMailings, { user: u, params: { userId: id } }),
  ],
];

describe('a company admin', () => {
  it.each(MANAGEMENT_ACTIONS)(
    '%s a member of their own group, not of another',
    async (_, act) => {
      expect((await act(companyAdminOfA, DAVE)).status).toBe(200);

      expect(await act(companyAdminOfA, FRANK)).toEqual(REFUSED);
      expect(Users.__records.find((r) => r._id === FRANK).name).toBe('Frank');
    }
  );

  // Editing a tech admin's email, then resetting the password, would hand the
  // company admin the account and its integrations.
  it.each(
    MANAGEMENT_ACTIONS.filter(([label]) =>
      [
        'updates',
        'activates',
        'deactivates',
        'resets the password of',
      ].includes(label)
    )
  )('%s no tech admin of their group', async (_, act) => {
    expect(await act(companyAdminOfA, TINA)).toEqual({
      status: 403,
      error: 'FORBIDDEN_USER_MANAGEMENT',
    });
  });

  it('changes no tech admin email', async () => {
    const refused = await call(controller.update, {
      user: companyAdminOfA,
      params: { userId: TINA },
      body: { email: 'carol@a.test' },
    });

    expect(refused.status).toBe(403);
    expect(Users.__records.find((r) => r._id === TINA).email).toBe(
      'tina@a.test'
    );
  });

  it('creates no tech admin', async () => {
    expect(
      await call(controller.create, {
        user: companyAdminOfA,
        body: {
          groupId: GROUP_A,
          email: 'new@a.test',
          name: 'New',
          role: 'company_admin_tech',
        },
      })
    ).toEqual({ status: 403, error: 'FORBIDDEN_ROLE_GRANT' });
  });

  it('creates users in their own group only', async () => {
    const ok = await call(controller.create, {
      user: companyAdminOfA,
      body: { groupId: GROUP_A, email: 'new@a.test', name: 'New' },
    });
    expect(ok.status).toBe(200);

    const refused = await call(controller.create, {
      user: companyAdminOfA,
      body: { groupId: GROUP_B, email: 'new@b.test', name: 'New' },
    });
    expect(refused).toEqual(REFUSED);
  });
});

describe('an admin', () => {
  it('reaches every group', async () => {
    expect(
      (await call(controller.read, { user: admin, params: { userId: FRANK } }))
        .status
    ).toBe(200);
    expect(
      (
        await call(controller.create, {
          user: admin,
          body: { groupId: GROUP_B, email: 'new@b.test', name: 'New' },
        })
      ).status
    ).toBe(200);
  });
});
