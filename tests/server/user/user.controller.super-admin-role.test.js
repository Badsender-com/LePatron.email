'use strict';

// Acceptance tests of epic #1153, the role itself: who can give and take the
// super admin role, and to whom. Role changes already go through the user
// controller, so the guardrails are specified there, with the authenticated
// user simulated the way passport puts it on the request and the models
// replaced by an in-memory store that honours the queries like MongoDB
// would. Each refusal is a distinct error code, so the screen of #1156 can
// show its own message.
//
// Management of a super admin account (edit, deactivate, reactivate, list) is
// in user.controller.super-admin-management.test.js.

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
const controller = require('../../../packages/server/user/user.controller.js');
const {
  PLATFORM_GROUP,
  CLIENT_GROUP,
  ALICE,
  BOB,
  CAROL,
  DAVE,
  ERIN,
  GROUPS,
  USERS,
  actorFrom,
  bootstrap,
  call,
  expectRefusal,
  expectRefusedOutright,
  readUserVia,
  withDeactivated,
} = require('../../helpers/super-admin-fixtures.js');

// The codes of the refusals; #1155 adds them to ERROR_CODES.
const FORBIDDEN_SUPER_ADMIN_ROLE_CHANGE = 'FORBIDDEN_SUPER_ADMIN_ROLE_CHANGE';
const FORBIDDEN_SUPER_ADMIN_SELF_DEMOTION =
  'FORBIDDEN_SUPER_ADMIN_SELF_DEMOTION';
const LAST_SUPER_ADMIN_PROTECTED = 'LAST_SUPER_ADMIN_PROTECTED';
const SUPER_ADMIN_OUTSIDE_PLATFORM_GROUP = 'SUPER_ADMIN_OUTSIDE_PLATFORM_GROUP';
const PLATFORM_GROUP_NOT_FOUND = 'PLATFORM_GROUP_NOT_FOUND';
const INVALID_ROLE_PARAM = 'INVALID_ROLE_PARAM';

const actor = (id) => actorFrom(store.userRecord(id));
const create = (user, body) => call(controller.create, { user, body });
const update = (user, userId, body) =>
  call(controller.update, { user, params: { userId }, body });
const read = readUserVia(controller);

beforeEach(() => {
  store.seed({ groups: GROUPS, users: USERS });
});

// Turned on by #1155 (super admin as a persisted role: admin status,
// guardrails and listing).
describe.skip('granting and revoking the super admin role (#1155)', () => {
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

    it('accepts the platform group when the screen names it', async () => {
      const { status, body } = await create(actor(ALICE), {
        ...newSuperAdmin,
        groupId: PLATFORM_GROUP,
      });

      expect(status).toBe(200);
      expect(body.role).toBe('super_admin');
      expect(body.group.id).toBe(PLATFORM_GROUP);
    });

    it('refuses a role the product does not define', async () => {
      const result = await create(actor(ALICE), {
        ...newSuperAdmin,
        role: 'owner',
      });

      expectRefusal(result, 400, INVALID_ROLE_PARAM);
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

      expectRefusedOutright(result);
    });

    it('cannot be created in a client group', async () => {
      const result = await create(actor(ALICE), {
        ...newSuperAdmin,
        groupId: CLIENT_GROUP,
      });

      expectRefusal(result, 403, SUPER_ADMIN_OUTSIDE_PLATFORM_GROUP);
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

      expectRefusal(result, 403, SUPER_ADMIN_OUTSIDE_PLATFORM_GROUP);
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

    it('a super admin re-sending their own role is not a demotion', async () => {
      // The edit page sends the whole user back, role included.
      const { status } = await update(actor(ALICE), ALICE, {
        name: 'Alice B.',
        role: 'super_admin',
      });

      expect(status).toBe(200);
      expect((await read(ALICE)).role).toBe('super_admin');
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
      store.seed({ groups: GROUPS, users: withDeactivated(BOB) });

      const result = await update(bootstrap, ALICE, { role: 'regular_user' });

      expectRefusal(result, 409, LAST_SUPER_ADMIN_PROTECTED);
    });

    it('a company admin of the platform group cannot demote a super admin', async () => {
      const result = await update(actor(CAROL), ALICE, {
        role: 'regular_user',
      });

      expectRefusal(result, 403, FORBIDDEN_SUPER_ADMIN_ROLE_CHANGE);
      expect((await read(ALICE)).role).toBe('super_admin');
    });

    it('a company admin of a client group cannot demote a super admin', async () => {
      const result = await update(actor(ERIN), ALICE, {
        role: 'regular_user',
      });

      expectRefusedOutright(result);
    });
  });
});
