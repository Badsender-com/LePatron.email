'use strict';

// A super admin lists the mailings of a workspace of its selected group like a
// company admin of that group (ADR 0002, amended). Today it is refused as a
// non-member of the workspace, and past that the listing filters an admin on
// "no company at all". A request naming a workspace takes the workspace's
// group, whatever group is selected.
//
// The models stand for the stored data: `Mailings.findForApiWithPagination`
// answers the mailings matching the company and the workspace it is asked
// for; the client group keeps each workspace to its members.

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

const mockStoredWorkspaces = [
  {
    _id: CLIENT_WORKSPACE,
    name: 'Newsletters',
    group: CLIENT_GROUP,
    _company: CLIENT_GROUP,
    _users: ['frank'],
    folders: [],
  },
];

jest.mock('../../../packages/server/common/models.common.js', () => {
  const findWorkspace = (id) =>
    mockStoredWorkspaces.find((w) => String(w._id) === String(id)) || null;
  return {
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
    Workspaces: {
      exists: jest.fn((filter) => Promise.resolve(!!findWorkspace(filter._id))),
      findById: jest.fn((id) => ({
        populate: () => Promise.resolve(findWorkspace(id)),
      })),
    },
    Groups: {
      findById: jest.fn((id) =>
        Promise.resolve({ _id: id, userHasAccessToAllWorkspaces: false })
      ),
    },
    Galleries: {},
    Folders: {},
    Tags: {},
    Users: {},
    Templates: {},
  };
});
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
const member = {
  id: 'frank',
  role: 'regular_user',
  group: { id: CLIENT_GROUP },
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

const names = ({ items }) => items.map((m) => m.name);

// Turned on by #1275 (super admins in the modules of their selected group)
describe.skip('listing the mailings of a workspace as a super admin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists the mailings of the workspace, member or not', async () => {
    expect(names(await list(superAdmin))).toEqual(['Spring sale', 'Welcome']);
  });

  it('lists them whatever group is selected: the workspace says which group is read', async () => {
    const elsewhere = { ...superAdmin, selectedGroup: { id: PLATFORM_GROUP } };

    expect(names(await list(elsewhere))).toEqual(['Spring sale', 'Welcome']);
  });

  it('refuses a company admin of another group with a 404, where today it gets an empty list', async () => {
    await expect(list(companyAdminOfThePlatform)).rejects.toMatchObject({
      status: 404,
    });
  });
});

// Today's behaviour, which the change must keep.
describe('listing the mailings of a workspace as a member', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists the mailings of the workspace', async () => {
    expect(names(await list(member))).toEqual(['Spring sale', 'Welcome']);
  });
});
