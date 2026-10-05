'use strict';

// The platform group is a flag an admin can move or unset through the API.
// A super admin always belongs to the platform group (ADR 0002), and the
// invariant is checked when the role is granted; so the flag cannot leave a
// group while active super admins belong to it, or the invariant would break
// after the grant.

jest.mock('../../../packages/server/common/models.common.js', () => {
  const { createStore } = require('../../helpers/fake-user-models.js');
  const store = createStore();
  return {
    Users: store.Users,
    Groups: store.Groups,
    Mailings: store.Mailings,
    Profiles: {},
    Templates: {},
    __store: store,
  };
});
jest.mock('../../../packages/server/group/group.service.js', () => ({}));
jest.mock('../../../packages/server/profile/profile.service.js', () => ({}));
jest.mock(
  '../../../packages/server/emails-group/emails-group.service.js',
  () => ({})
);
jest.mock(
  '../../../packages/server/personalized-variables/personalized-variable.service.js',
  () => ({})
);
jest.mock('../../../packages/server/group/group-ftp.service.js', () => ({}));
jest.mock(
  '../../../packages/server/ai-skill/services/invocation-log.service.js',
  () => ({})
);
jest.mock(
  '../../../packages/server/taxonomy/taxonomy-defaults.service.js',
  () => ({})
);
jest.mock(
  '../../../packages/server/workspace/workspace.service.js',
  () => ({})
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  __store: store,
} = require('../../../packages/server/common/models.common.js');
const controller = require('../../../packages/server/group/group.controller.js');
const {
  PLATFORM_GROUP,
  CLIENT_GROUP,
  GROUPS,
  USERS,
  bootstrap,
  call,
} = require('../../helpers/super-admin-fixtures.js');

// The code of the refusal; #1155 adds it to ERROR_CODES.
const PLATFORM_GROUP_HAS_SUPER_ADMINS = 'PLATFORM_GROUP_HAS_SUPER_ADMINS';

const setPlatform = (groupId, isPlatform) =>
  call(controller.setPlatform, {
    user: bootstrap,
    params: { groupId },
    body: { isPlatform },
  });

const isPlatform = async (groupId) =>
  (await store.Groups.findById(groupId)).isPlatform === true;

const withoutSuperAdmins = USERS.filter((u) => u.role !== 'super_admin');

describe('the platform flag', () => {
  describe('on a group without super admins', () => {
    beforeEach(() => {
      store.seed({ groups: GROUPS, users: withoutSuperAdmins });
    });

    it('can be unset', async () => {
      const { status } = await setPlatform(PLATFORM_GROUP, false);

      expect(status).toBe(200);
      expect(await isPlatform(PLATFORM_GROUP)).toBe(false);
    });

    it('can be moved to another group', async () => {
      const { status } = await setPlatform(CLIENT_GROUP, true);

      expect(status).toBe(200);
      expect(await isPlatform(CLIENT_GROUP)).toBe(true);
      expect(await isPlatform(PLATFORM_GROUP)).toBe(false);
    });
  });

  // Turned on by #1155 (super admin as a persisted role: admin status,
  // guardrails and listing).
  describe('on the group of active super admins (#1155)', () => {
    beforeEach(() => {
      store.seed({ groups: GROUPS, users: USERS });
    });

    it('cannot be unset', async () => {
      const result = await setPlatform(PLATFORM_GROUP, false);

      expect(result).toEqual({
        status: 409,
        error: PLATFORM_GROUP_HAS_SUPER_ADMINS,
      });
      expect(await isPlatform(PLATFORM_GROUP)).toBe(true);
    });

    it('cannot be moved to another group', async () => {
      const result = await setPlatform(CLIENT_GROUP, true);

      expect(result).toEqual({
        status: 409,
        error: PLATFORM_GROUP_HAS_SUPER_ADMINS,
      });
      expect(await isPlatform(PLATFORM_GROUP)).toBe(true);
      expect(await isPlatform(CLIENT_GROUP)).toBe(false);
    });

    it('can leave once every super admin of the group is deactivated', async () => {
      store.seed({
        groups: GROUPS,
        users: USERS.map((u) =>
          u.role === 'super_admin' ? { ...u, isDeactivated: true } : u
        ),
      });

      const { status } = await setPlatform(PLATFORM_GROUP, false);

      expect(status).toBe(200);
      expect(await isPlatform(PLATFORM_GROUP)).toBe(false);
    });
  });
});
