'use strict';

// Acceptance tests of epic #1153, the account behind the role: who can edit,
// deactivate, reactivate a super admin or resend their password email, and
// who sees them listed. Same seams and same store as
// user.controller.super-admin-role.test.js.

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
jest.mock('../../../packages/server/group/group.service.js', () => ({}));
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
const FORBIDDEN_SUPER_ADMIN_MANAGEMENT = 'FORBIDDEN_SUPER_ADMIN_MANAGEMENT';
const FORBIDDEN_SUPER_ADMIN_SELF_DEACTIVATION =
  'FORBIDDEN_SUPER_ADMIN_SELF_DEACTIVATION';
const LAST_SUPER_ADMIN_PROTECTED = 'LAST_SUPER_ADMIN_PROTECTED';
const INVALID_ROLE_PARAM = 'INVALID_ROLE_PARAM';

const actor = (id) => actorFrom(store.userRecord(id));
const update = (user, userId, body) =>
  call(controller.update, { user, params: { userId }, body });
const deactivate = (user, userId) =>
  call(controller.deactivate, { user, params: { userId } });
const activate = (user, userId) =>
  call(controller.activate, { user, params: { userId } });
const resetPassword = (user, userId) =>
  call(controller.adminResetPassword, { user, params: { userId } });
const list = (user, query) => call(controller.list, { user, query });
const read = readUserVia(controller);

beforeEach(() => {
  store.seed({ groups: GROUPS, users: USERS });
});

// Turned on by #1155 (super admin as a persisted role: admin status,
// guardrails and listing).
describe('managing a super admin account (#1155)', () => {
  describe('editing', () => {
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

    it('a company admin of the platform group cannot edit a super admin', async () => {
      const result = await update(actor(CAROL), ALICE, { name: 'Hacked' });

      expectRefusal(result, 403, FORBIDDEN_SUPER_ADMIN_MANAGEMENT);
      expect((await read(ALICE)).name).toBe('Alice');
    });

    it('a company admin of a client group cannot edit a super admin', async () => {
      const result = await update(actor(ERIN), ALICE, { name: 'Hacked' });

      expectRefusedOutright(result);
      expect((await read(ALICE)).name).toBe('Alice');
    });

    it('a company admin still manages the other members of their group', async () => {
      // The edit page sends the whole user back, role included.
      const { status } = await update(actor(CAROL), DAVE, {
        name: 'David',
        role: 'regular_user',
      });

      expect(status).toBe(200);
      expect((await read(DAVE)).name).toBe('David');
    });
  });

  describe('password email', () => {
    it('a super admin resends the password email of another one', async () => {
      const { status } = await resetPassword(actor(ALICE), BOB);

      expect(status).toBe(200);
      expect((await read(BOB)).status).toBe('password-mail-sent');
    });

    it('a company admin cannot reset the password of a super admin', async () => {
      const result = await resetPassword(actor(CAROL), ALICE);

      expectRefusal(result, 403, FORBIDDEN_SUPER_ADMIN_MANAGEMENT);
      expect((await read(ALICE)).status).toBe('confirmed');
    });
  });

  describe('deactivating and reactivating', () => {
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

    it('a company admin of the platform group cannot deactivate a super admin', async () => {
      const result = await deactivate(actor(CAROL), ALICE);

      expectRefusal(result, 403, FORBIDDEN_SUPER_ADMIN_MANAGEMENT);
      expect((await read(ALICE)).isDeactivated).toBe(false);
    });

    it('a company admin of a client group cannot deactivate a super admin', async () => {
      const result = await deactivate(actor(ERIN), ALICE);

      expectRefusedOutright(result);
    });

    it('a super admin reactivates a deactivated one', async () => {
      store.seed({ groups: GROUPS, users: withDeactivated(BOB) });

      const { status } = await activate(actor(ALICE), BOB);

      expect(status).toBe(200);
      const bob = await read(BOB);
      expect(bob.isDeactivated).toBe(false);
      expect(bob.role).toBe('super_admin');
    });

    it('a company admin cannot reactivate a super admin', async () => {
      store.seed({ groups: GROUPS, users: withDeactivated(BOB) });

      const result = await activate(actor(CAROL), BOB);

      expectRefusal(result, 403, FORBIDDEN_SUPER_ADMIN_MANAGEMENT);
      expect((await read(BOB)).isDeactivated).toBe(true);
    });
  });

  describe('listing the super admins', () => {
    it('lists the super admins, and only them, for a super admin', async () => {
      const { status, body } = await list(actor(ALICE), {
        role: 'super_admin',
      });

      expect(status).toBe(200);
      expect(body.items.map((u) => u.id).sort()).toEqual([ALICE, BOB].sort());
    });

    it('lists the super admins for the bootstrap account', async () => {
      const { body } = await list(bootstrap, { role: 'super_admin' });

      expect(body.items.map((u) => u.id).sort()).toEqual([ALICE, BOB].sort());
    });

    it('still lists everyone without a role filter', async () => {
      const { body } = await list(bootstrap, {});

      expect(body.items).toHaveLength(USERS.length);
    });

    it('refuses a role the product does not define', async () => {
      expectRefusal(
        await list(bootstrap, { role: 'owner' }),
        400,
        INVALID_ROLE_PARAM
      );
    });

    it('refuses a role filter that is not a plain value', async () => {
      const result = await list(bootstrap, { role: { $ne: 'super_admin' } });

      expectRefusal(result, 400, INVALID_ROLE_PARAM);
    });
  });
});
