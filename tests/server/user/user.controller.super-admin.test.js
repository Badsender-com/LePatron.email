'use strict';

// Acceptance tests of epic #1153: super admin as a persisted role. Role changes
// already go through the user controller, so the guardrails are specified
// there, with the authenticated user simulated the way passport puts it on
// the request and the models replaced by an in-memory store that honours the
// queries like MongoDB would. Each refusal is a distinct error code, so the
// screen of #1156 can show its own message.

jest.mock('../../../packages/server/common/models.common.js', () => {
  const { createStore } = require('../../helpers/fake-user-models.js');
  const store = createStore();
  return {
    Users: store.Users,
    Groups: store.Groups,
    Mailings: store.Mailings,
    __store: store,
  };
});
jest.mock('../../../packages/server/group/group.service.js', () => {
  const { NotFound } = require('http-errors');
  const {
    Groups,
  } = require('../../../packages/server/common/models.common.js');
  return {
    findById: async (groupId) => {
      const group = await Groups.findById(groupId);
      if (!group) throw new NotFound(`no group with id ${groupId} found`);
      return group;
    },
  };
});
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  __store: store,
} = require('../../../packages/server/common/models.common.js');
const config = require('../../../packages/server/node.config.js');
const controller = require('../../../packages/server/user/user.controller.js');

// The codes of the refusals; #1155 adds them to ERROR_CODES.
const FORBIDDEN_SUPER_ADMIN_ROLE_CHANGE = 'FORBIDDEN_SUPER_ADMIN_ROLE_CHANGE';
const FORBIDDEN_SUPER_ADMIN_MANAGEMENT = 'FORBIDDEN_SUPER_ADMIN_MANAGEMENT';
const FORBIDDEN_SUPER_ADMIN_SELF_DEMOTION =
  'FORBIDDEN_SUPER_ADMIN_SELF_DEMOTION';
const FORBIDDEN_SUPER_ADMIN_SELF_DEACTIVATION =
  'FORBIDDEN_SUPER_ADMIN_SELF_DEACTIVATION';
const LAST_SUPER_ADMIN_PROTECTED = 'LAST_SUPER_ADMIN_PROTECTED';
const SUPER_ADMIN_OUTSIDE_PLATFORM_GROUP = 'SUPER_ADMIN_OUTSIDE_PLATFORM_GROUP';
const PLATFORM_GROUP_NOT_FOUND = 'PLATFORM_GROUP_NOT_FOUND';

const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';
const CLIENT_GROUP = '507f1f77bcf86cd799439b01';

const ALICE = '507f1f77bcf86cd799439101'; // super admin
const BOB = '507f1f77bcf86cd799439102'; // super admin
const CAROL = '507f1f77bcf86cd799439103'; // company admin of the platform group
const DAVE = '507f1f77bcf86cd799439104'; // regular user of the platform group
const ERIN = '507f1f77bcf86cd799439105'; // company admin of a client group
const FRANK = '507f1f77bcf86cd799439106'; // regular user of a client group

const GROUPS = [
  { _id: PLATFORM_GROUP, name: 'Platform', isPlatform: true },
  { _id: CLIENT_GROUP, name: 'A client' },
];

const USERS = [
  user(ALICE, 'Alice', 'super_admin', PLATFORM_GROUP),
  user(BOB, 'Bob', 'super_admin', PLATFORM_GROUP),
  user(CAROL, 'Carol', 'company_admin', PLATFORM_GROUP),
  user(DAVE, 'Dave', 'regular_user', PLATFORM_GROUP),
  user(ERIN, 'Erin', 'company_admin', CLIENT_GROUP),
  user(FRANK, 'Frank', 'regular_user', CLIENT_GROUP),
];

function user(_id, name, role, _company, extra = {}) {
  return {
    _id,
    name,
    role,
    _company,
    email: `${name.toLowerCase()}@example.test`,
    lang: 'fr',
    password: 'hashed',
    ...extra,
  };
}

// What passport puts on `req.user`: the stored user's JSON.
function actor(id) {
  const record = store.userRecord(id);
  return {
    id,
    name: record.name,
    role: record.role,
    isAdmin: record.role === 'super_admin',
    isGroupAdmin: record.role === 'company_admin',
    group: { id: record._company },
  };
}

// The bootstrap account: an admin outside the database.
const bootstrap = { id: config.admin.id, isAdmin: true, name: 'admin' };

function call(handler, { user, params = {}, body = {}, query = {} }) {
  return new Promise((resolve) => {
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode || 200, body: payload });
      },
      send(payload) {
        resolve({ status: this.statusCode || 200, body: payload });
      },
    };
    handler({ user, params, body, query }, res, (err) =>
      resolve({ status: err.status, error: err.message })
    );
  });
}

const create = (user, body) => call(controller.create, { user, body });
const update = (user, userId, body) =>
  call(controller.update, { user, params: { userId }, body });
const deactivate = (user, userId) =>
  call(controller.deactivate, { user, params: { userId } });
const activate = (user, userId) =>
  call(controller.activate, { user, params: { userId } });
const resetPassword = (user, userId) =>
  call(controller.adminResetPassword, { user, params: { userId } });
const read = async (userId) => {
  const { body } = await call(controller.read, {
    user: bootstrap,
    params: { userId },
  });
  return body;
};

function expectRefusal(result, status, code) {
  expect(result).toEqual({ status, error: code });
}

beforeEach(() => {
  store.seed({ groups: GROUPS, users: USERS });
});

// Turned on by #1155 (super admin as a persisted role: admin status,
// guardrails and listing).
describe.skip('super admin guardrails in the user controller (#1155)', () => {
  describe('creating a super admin', () => {
    const newSuperAdmin = {
      name: 'Grace',
      email: 'grace@example.test',
      lang: 'en',
      role: 'super_admin',
    };

    it('a super admin creates one, attached to the platform group', async () => {
      const { status, body } = await create(actor(ALICE), newSuperAdmin);

      expect(status).toBe(200);
      expect(body.role).toBe('super_admin');
      expect(body.group.id).toBe(PLATFORM_GROUP);
      expect(body.isAdmin).toBe(true);
    });

    it('the bootstrap account creates the first one of an environment', async () => {
      store.seed({
        groups: GROUPS,
        users: USERS.filter((u) => u.role !== 'super_admin'),
      });

      const { status, body } = await create(bootstrap, newSuperAdmin);

      expect(status).toBe(200);
      expect(body.role).toBe('super_admin');
      expect(body.group.id).toBe(PLATFORM_GROUP);
    });

    it('a company admin of the platform group cannot', async () => {
      const result = await create(actor(CAROL), {
        ...newSuperAdmin,
        groupId: PLATFORM_GROUP,
      });

      expectRefusal(result, 403, FORBIDDEN_SUPER_ADMIN_ROLE_CHANGE);
      expect(await store.Users.countDocuments({ role: 'super_admin' })).toBe(2);
    });

    it('a company admin of a client group cannot either', async () => {
      const result = await create(actor(ERIN), {
        ...newSuperAdmin,
        groupId: CLIENT_GROUP,
      });

      expectRefusal(result, 403, FORBIDDEN_SUPER_ADMIN_ROLE_CHANGE);
    });

    it('cannot be created in a client group', async () => {
      const result = await create(actor(ALICE), {
        ...newSuperAdmin,
        groupId: CLIENT_GROUP,
      });

      expectRefusal(result, 400, SUPER_ADMIN_OUTSIDE_PLATFORM_GROUP);
    });

    it('is refused with its own code when no platform group exists', async () => {
      store.seed({
        groups: GROUPS.filter((g) => !g.isPlatform),
        users: USERS.filter((u) => u._company !== PLATFORM_GROUP),
      });

      const result = await create(bootstrap, newSuperAdmin);

      expectRefusal(result, 409, PLATFORM_GROUP_NOT_FOUND);
    });
  });

  describe('promoting a member of the platform group', () => {
    it('a super admin promotes a company admin of the platform group', async () => {
      const { status } = await update(actor(ALICE), CAROL, {
        role: 'super_admin',
      });

      expect(status).toBe(200);
      const carol = await read(CAROL);
      expect(carol.role).toBe('super_admin');
      expect(carol.group.id).toBe(PLATFORM_GROUP);
    });

    it('the bootstrap account promotes a regular user of the platform group', async () => {
      const { status } = await update(bootstrap, DAVE, { role: 'super_admin' });

      expect(status).toBe(200);
      expect((await read(DAVE)).role).toBe('super_admin');
    });

    it('a company admin cannot promote themselves', async () => {
      const result = await update(actor(CAROL), CAROL, {
        name: 'Carol',
        role: 'super_admin',
      });

      expectRefusal(result, 403, FORBIDDEN_SUPER_ADMIN_ROLE_CHANGE);
      expect((await read(CAROL)).role).toBe('company_admin');
    });

    it('a company admin cannot promote a member of their group', async () => {
      const result = await update(actor(CAROL), DAVE, { role: 'super_admin' });

      expectRefusal(result, 403, FORBIDDEN_SUPER_ADMIN_ROLE_CHANGE);
      expect((await read(DAVE)).role).toBe('regular_user');
    });

    it('a member of a client group cannot be promoted: accounts are not moved', async () => {
      const result = await update(actor(ALICE), ERIN, { role: 'super_admin' });

      expectRefusal(result, 400, SUPER_ADMIN_OUTSIDE_PLATFORM_GROUP);
      const erin = await read(ERIN);
      expect(erin.role).toBe('company_admin');
      expect(erin.group.id).toBe(CLIENT_GROUP);
    });
  });

  describe('demoting a super admin', () => {
    it('a super admin demotes another one to the role of their choice', async () => {
      const { status } = await update(actor(ALICE), BOB, {
        role: 'regular_user',
      });

      expect(status).toBe(200);
      const bob = await read(BOB);
      expect(bob.role).toBe('regular_user');
      expect(bob.isAdmin).toBe(false);
      expect(bob.group.id).toBe(PLATFORM_GROUP);
    });

    it('a super admin can demote to company admin of the platform group', async () => {
      await update(actor(ALICE), BOB, { role: 'company_admin' });

      expect((await read(BOB)).role).toBe('company_admin');
    });

    it('a super admin cannot demote themselves', async () => {
      const result = await update(actor(ALICE), ALICE, {
        role: 'regular_user',
      });

      expectRefusal(result, 403, FORBIDDEN_SUPER_ADMIN_SELF_DEMOTION);
      expect((await read(ALICE)).role).toBe('super_admin');
    });

    it('the last active super admin cannot be demoted, not even by the bootstrap account', async () => {
      store.seed({ groups: GROUPS, users: USERS.filter((u) => u._id !== BOB) });

      const result = await update(bootstrap, ALICE, { role: 'regular_user' });

      expectRefusal(result, 409, LAST_SUPER_ADMIN_PROTECTED);
      expect((await read(ALICE)).role).toBe('super_admin');
    });

    it('a deactivated super admin does not count as remaining', async () => {
      store.seed({
        groups: GROUPS,
        users: USERS.map((u) =>
          u._id === BOB ? { ...u, isDeactivated: true } : u
        ),
      });

      const result = await update(bootstrap, ALICE, { role: 'regular_user' });

      expectRefusal(result, 409, LAST_SUPER_ADMIN_PROTECTED);
    });

    it('a company admin cannot demote a super admin', async () => {
      const result = await update(actor(CAROL), ALICE, {
        role: 'regular_user',
      });

      expectRefusal(result, 403, FORBIDDEN_SUPER_ADMIN_ROLE_CHANGE);
      expect((await read(ALICE)).role).toBe('super_admin');
    });
  });

  describe('managing a super admin account', () => {
    it('a super admin edits another one', async () => {
      const { status } = await update(actor(ALICE), BOB, {
        name: 'Robert',
        lang: 'en',
      });

      expect(status).toBe(200);
      const bob = await read(BOB);
      expect(bob.name).toBe('Robert');
      expect(bob.role).toBe('super_admin');
    });

    it('a super admin edits their own name and language', async () => {
      const { status } = await update(actor(ALICE), ALICE, {
        name: 'Alice B.',
        lang: 'en',
      });

      expect(status).toBe(200);
      expect((await read(ALICE)).name).toBe('Alice B.');
    });

    it('a company admin cannot edit a super admin', async () => {
      const result = await update(actor(CAROL), ALICE, { name: 'Hacked' });

      expectRefusal(result, 403, FORBIDDEN_SUPER_ADMIN_MANAGEMENT);
      expect((await read(ALICE)).name).toBe('Alice');
    });

    it('a company admin cannot deactivate a super admin', async () => {
      const result = await deactivate(actor(CAROL), ALICE);

      expectRefusal(result, 403, FORBIDDEN_SUPER_ADMIN_MANAGEMENT);
      expect((await read(ALICE)).isDeactivated).toBe(false);
    });

    it('a company admin cannot reactivate a super admin', async () => {
      store.seed({
        groups: GROUPS,
        users: USERS.map((u) =>
          u._id === BOB ? { ...u, isDeactivated: true } : u
        ),
      });

      const result = await activate(actor(CAROL), BOB);

      expectRefusal(result, 403, FORBIDDEN_SUPER_ADMIN_MANAGEMENT);
      expect((await read(BOB)).isDeactivated).toBe(true);
    });

    it('a company admin cannot reset the password of a super admin', async () => {
      const result = await resetPassword(actor(CAROL), ALICE);

      expectRefusal(result, 403, FORBIDDEN_SUPER_ADMIN_MANAGEMENT);
    });

    it('a company admin still manages the other members of their group', async () => {
      const { status } = await update(actor(CAROL), DAVE, { name: 'David' });

      expect(status).toBe(200);
      expect((await read(DAVE)).name).toBe('David');
    });
  });

  describe('deactivating and reactivating a super admin', () => {
    it('a super admin deactivates another one while one remains', async () => {
      const { status } = await deactivate(actor(ALICE), BOB);

      expect(status).toBe(200);
      expect((await read(BOB)).isDeactivated).toBe(true);
    });

    it('a super admin cannot deactivate themselves', async () => {
      const result = await deactivate(actor(ALICE), ALICE);

      expectRefusal(result, 403, FORBIDDEN_SUPER_ADMIN_SELF_DEACTIVATION);
      expect((await read(ALICE)).isDeactivated).toBe(false);
    });

    it('the last active super admin cannot be deactivated, not even by the bootstrap account', async () => {
      store.seed({ groups: GROUPS, users: USERS.filter((u) => u._id !== BOB) });

      const result = await deactivate(bootstrap, ALICE);

      expectRefusal(result, 409, LAST_SUPER_ADMIN_PROTECTED);
      expect((await read(ALICE)).isDeactivated).toBe(false);
    });

    it('a super admin reactivates a deactivated one', async () => {
      store.seed({
        groups: GROUPS,
        users: USERS.map((u) =>
          u._id === BOB ? { ...u, isDeactivated: true } : u
        ),
      });

      const { status } = await activate(actor(ALICE), BOB);

      expect(status).toBe(200);
      const bob = await read(BOB);
      expect(bob.isDeactivated).toBe(false);
      expect(bob.role).toBe('super_admin');
    });

    it('a super admin resends the password email of another one', async () => {
      const { status } = await resetPassword(actor(ALICE), BOB);

      expect(status).toBe(200);
      expect((await read(BOB)).status).not.toBe('confirmed');
    });
  });

  describe('listing', () => {
    it('lists the super admins, and only them, for a super admin', async () => {
      const { status, body } = await call(controller.list, {
        user: actor(ALICE),
        query: { role: 'super_admin' },
      });

      expect(status).toBe(200);
      expect(body.items.map((u) => u.id).sort()).toEqual([ALICE, BOB].sort());
    });

    it('lists the super admins for the bootstrap account', async () => {
      const { body } = await call(controller.list, {
        user: bootstrap,
        query: { role: 'super_admin' },
      });

      expect(body.items.map((u) => u.id).sort()).toEqual([ALICE, BOB].sort());
    });

    it('keeps super admins out of the user list of the platform group', async () => {
      const { status, body } = await call(controller.getByGroupId, {
        user: actor(CAROL),
      });

      expect(status).toBe(200);
      expect(body.map((u) => u.id).sort()).toEqual([CAROL, DAVE].sort());
    });

    it('leaves the user list of a client group unchanged', async () => {
      const { body } = await call(controller.getByGroupId, {
        user: actor(ERIN),
      });

      expect(body.map((u) => u.id).sort()).toEqual([ERIN, FRANK].sort());
    });
  });
});
