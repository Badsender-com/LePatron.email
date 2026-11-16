'use strict';

// The members of a workspace are users of its company: whatever else a
// request lists (another company's user, something that is not an id) is
// left out when the workspace is created or updated.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Workspaces: { exists: jest.fn(), updateOne: jest.fn(), create: jest.fn() },
  Groups: { findById: jest.fn() },
  Folders: {},
  Mailings: {},
  Users: { find: jest.fn() },
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  Workspaces,
  Groups,
  Users,
} = require('../../../packages/server/common/models.common.js');
const workspaceService = require('../../../packages/server/workspace/workspace.service.js');

const WORKSPACE = '507f1f77bcf86cd799439011';
const COMPANY = '507f1f77bcf86cd799439001';
const COLLEAGUE = '507f1f77bcf86cd799439101';
const OUTSIDER = '507f1f77bcf86cd799439102';

beforeEach(() => {
  jest.clearAllMocks();
  Workspaces.exists.mockResolvedValue(false);
  Workspaces.updateOne.mockResolvedValue({ ok: 1 });
  Workspaces.create.mockResolvedValue({ _id: WORKSPACE });
  Groups.findById.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ _id: COMPANY }) }),
  });
  // The database answers the users of the company among those asked.
  Users.find.mockImplementation((query) => ({
    select: () => ({
      lean: () =>
        Promise.resolve(
          String(query._company) === COMPANY &&
            query._id.$in.map(String).includes(COLLEAGUE)
            ? [{ _id: COLLEAGUE }]
            : []
        ),
    }),
  }));
});

const ASKED = [COLLEAGUE, OUTSIDER, { $ne: null }, 'not-an-id', 42];

it('updates a workspace with the users of its company only', async () => {
  await workspaceService.updateWorkspace({
    id: WORKSPACE,
    groupId: COMPANY,
    _users: ASKED,
  });

  expect(Users.find.mock.calls[0][0]._id.$in.map(String)).toEqual([
    COLLEAGUE,
    OUTSIDER,
  ]);
  expect(Workspaces.updateOne.mock.calls[0][1]._users.map(String)).toEqual([
    COLLEAGUE,
  ]);
});

it('creates a workspace with the users of its company only', async () => {
  await workspaceService.createWorkspace({
    name: 'Newsletters',
    groupId: COMPANY,
    selectedUsers: ASKED.map((id) => ({ id })),
  });

  expect(Workspaces.create.mock.calls[0][0]._users.map(String)).toEqual([
    COLLEAGUE,
  ]);
});

it('asks nothing for a workspace without members', async () => {
  await workspaceService.updateWorkspace({
    id: WORKSPACE,
    groupId: COMPANY,
    _users: [],
  });

  expect(Users.find).not.toHaveBeenCalled();
  expect(Workspaces.updateOne.mock.calls[0][1]._users).toEqual([]);
});
