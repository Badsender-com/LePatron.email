'use strict';

// A super admin lists the mailings of a workspace of its selected group like a
// company admin of that group (ADR 0002, amended). Today it is refused as a
// non-member of the workspace, and past that the listing filters an admin on
// "no company at all".
//
// `Mailings.findForApiWithPagination` stands for the stored mailings: it
// answers the ones matching the company and the workspace or folder it is
// asked for.

const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';
const CLIENT_GROUP = '507f1f77bcf86cd799439b01';
const CLIENT_WORKSPACE = '507f1f77bcf86cd799439011';
const OTHER_CLIENT_WORKSPACE = '507f1f77bcf86cd799439012';
const PLATFORM_WORKSPACE = '507f1f77bcf86cd799439013';

const mockStoredMailings = [
  { name: 'Spring sale', _company: CLIENT_GROUP, _workspace: CLIENT_WORKSPACE },
  { name: 'Welcome', _company: CLIENT_GROUP, _workspace: CLIENT_WORKSPACE },
  {
    name: 'Back to school',
    _company: CLIENT_GROUP,
    _workspace: OTHER_CLIENT_WORKSPACE,
  },
  {
    name: 'Platform news',
    _company: PLATFORM_GROUP,
    _workspace: PLATFORM_WORKSPACE,
  },
];

const mockWorkspaces = {
  [CLIENT_WORKSPACE]: {
    _id: CLIENT_WORKSPACE,
    name: 'Newsletters',
    group: CLIENT_GROUP,
    _company: CLIENT_GROUP,
    _users: [],
  },
};

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: {
    findForApiWithPagination: jest.fn((filter) =>
      Promise.resolve(
        mockStoredMailings.filter(
          (m) =>
            (filter._company === undefined ||
              String(filter._company) === m._company) &&
            (filter._workspace === undefined ||
              String(filter._workspace) === m._workspace)
        )
      )
    ),
  },
  Groups: {
    findById: jest.fn((id) =>
      Promise.resolve({ _id: id, userHasAccessToAllWorkspaces: false })
    ),
  },
  Galleries: {},
  Workspaces: {},
  Folders: {},
  Tags: {},
  Users: {},
  Templates: {},
}));
jest.mock('../../../packages/server/workspace/workspace.service.js', () => ({
  getWorkspace: jest.fn((id) => Promise.resolve(mockWorkspaces[id] || null)),
  restrictAccessingWorkspacesForNonMemberUser: jest.fn((workspace, user) =>
    Promise.resolve(!workspace._users.includes(user.id))
  ),
}));
jest.mock('../../../packages/server/folder/folder.service.js', () => ({}));
jest.mock('../../../packages/server/template/template.service.js', () => ({}));
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mailingService = require('../../../packages/server/mailing/mailing.service');

const superAdmin = {
  id: 'alice',
  role: 'super_admin',
  isAdmin: true,
  group: { id: PLATFORM_GROUP },
  selectedGroup: { id: CLIENT_GROUP },
};
const companyAdminOfThePlatform = {
  id: 'carol',
  role: 'company_admin',
  isGroupAdmin: true,
  group: { id: PLATFORM_GROUP },
};

const list = (user) =>
  mailingService.listMailingForWorkspaceOrFolder({
    workspaceId: CLIENT_WORKSPACE,
    user,
    paginationJSON: {},
    filtersJSON: {},
  });

// Turned on by #1275 (super admins in the modules of their selected group)
describe.skip('listing the mailings of a workspace as a super admin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists the mailings of the workspace, member or not', async () => {
    const { items } = await list(superAdmin);

    expect(items.map((m) => m.name)).toEqual(['Spring sale', 'Welcome']);
  });

  it('lists them whatever group is selected: the workspace says which group is read', async () => {
    const elsewhere = { ...superAdmin, selectedGroup: { id: PLATFORM_GROUP } };

    const { items } = await list(elsewhere);

    expect(items.map((m) => m.name)).toEqual(['Spring sale', 'Welcome']);
  });

  it('still refuses a company admin of another group', async () => {
    await expect(list(companyAdminOfThePlatform)).rejects.toMatchObject({
      status: 404,
    });
  });
});
