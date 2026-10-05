'use strict';

// The users tab of a group, and its workspace member pickers, read
// `GET /groups/:groupId/users`, served by `findUserByGroupId`. Super admins
// live in the platform group (ADR 0002) but are managed from their own
// screen, so that listing leaves them out; a client group's listing does not
// change.

jest.mock('../../../packages/server/common/models.common', () => {
  const { createStore } = require('../../helpers/fake-user-models.js');
  const store = createStore();
  return {
    Users: store.Users,
    Groups: store.Groups,
    Mailings: store.Mailings,
    Workspaces: {},
    Folders: {},
    Templates: {},
    Profiles: {},
    __store: store,
  };
});
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
} = require('../../../packages/server/common/models.common');
const groupService = require('../../../packages/server/group/group.service');
const {
  PLATFORM_GROUP,
  CLIENT_GROUP,
  CAROL,
  DAVE,
  ERIN,
  FRANK,
  GROUPS,
  USERS,
} = require('../../helpers/super-admin-fixtures.js');

const ids = (users) => users.map((u) => u.id).sort();

beforeEach(() => {
  store.seed({ groups: GROUPS, users: USERS });
});

describe('findUserByGroupId', () => {
  it('lists the members of a client group', async () => {
    const users = await groupService.findUserByGroupId(CLIENT_GROUP);

    expect(ids(users)).toEqual([ERIN, FRANK].sort());
  });

  it('rejects an unknown group', async () => {
    await expect(
      groupService.findUserByGroupId('507f1f77bcf86cd799439fff')
    ).rejects.toMatchObject({ status: 404 });
  });

  // Turned on by #1155 (super admin as a persisted role: admin status,
  // guardrails and listing).
  describe.skip('the platform group (#1155)', () => {
    it('keeps super admins out of its user list', async () => {
      const users = await groupService.findUserByGroupId(PLATFORM_GROUP);

      expect(ids(users)).toEqual([CAROL, DAVE].sort());
    });
  });
});
