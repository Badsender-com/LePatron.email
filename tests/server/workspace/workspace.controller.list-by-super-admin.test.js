'use strict';

// The workspace tree of Email Builder (ADR 0002, amended): a super admin sees
// every workspace of its selected group, with the right to write in each, like
// a company admin of that group. Today it gets its own platform group's,
// filtered on membership. A company admin and a regular user keep their own
// group's tree, whatever selected group a request claims.
//
// `Workspaces.find` stands for the stored workspaces, answered by company.

const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';
const CLIENT_GROUP = '507f1f77bcf86cd799439b01';

function mockWorkspace(_id, name, _company, _users = []) {
  const plain = { _id, name, _company, group: _company, _users, folders: [] };
  return { ...plain, toObject: () => ({ ...plain }) };
}

const mockStoredWorkspaces = [
  mockWorkspace('w-client-1', 'Newsletters', CLIENT_GROUP, ['frank']),
  mockWorkspace('w-client-2', 'Automations', CLIENT_GROUP),
  mockWorkspace('w-platform', 'Platform news', PLATFORM_GROUP, ['alice']),
];

jest.mock('../../../packages/server/common/models.common.js', () => {
  const populated = (items) => {
    const chain = {
      populate: () => chain,
      then: (resolve, reject) => Promise.resolve(items).then(resolve, reject),
    };
    return chain;
  };
  return {
    Workspaces: {
      find: jest.fn((filter) =>
        populated(
          mockStoredWorkspaces.filter(
            (w) => String(w._company) === String(filter._company)
          )
        )
      ),
    },
    Groups: {
      findById: jest.fn((id) =>
        Promise.resolve({ _id: id, userHasAccessToAllWorkspaces: false })
      ),
    },
    Folders: { aggregate: jest.fn().mockResolvedValue([]) },
    Mailings: {},
    Users: {},
  };
});
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const workspaceController = require('../../../packages/server/workspace/workspace.controller.js');

function listAs(user) {
  return new Promise((resolve, reject) => {
    workspaceController.listWorkspace(
      { user },
      { json: (payload) => resolve(payload) },
      reject
    );
  });
}

const tree = ({ items }) =>
  items.map(({ name, hasRights }) => ({ name, hasRights }));

// Turned on by #1275 (super admins in the modules of their selected group)
describe.skip('the workspace tree of a super admin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows every workspace of the selected group, with the right to write in each', async () => {
    const superAdmin = {
      id: 'alice',
      role: 'super_admin',
      isAdmin: true,
      group: { id: PLATFORM_GROUP },
      selectedGroup: { id: CLIENT_GROUP },
    };

    expect(tree(await listAs(superAdmin))).toEqual([
      { name: 'Automations', hasRights: true },
      { name: 'Newsletters', hasRights: true },
    ]);
  });
});

// Today's behaviour, which the change must keep.
describe('the workspace tree of a company admin or a regular user', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps a regular user on the workspaces it belongs to in its own group', async () => {
    const regularUser = {
      id: 'frank',
      role: 'regular_user',
      group: { id: CLIENT_GROUP },
      selectedGroup: { id: PLATFORM_GROUP },
    };

    expect(tree(await listAs(regularUser))).toEqual([
      { name: 'Newsletters', hasRights: true },
    ]);
  });

  it('keeps a company admin on its own group, whatever selected group the request claims', async () => {
    const companyAdmin = {
      id: 'carol',
      role: 'company_admin',
      isGroupAdmin: true,
      group: { id: PLATFORM_GROUP },
      selectedGroup: { id: CLIENT_GROUP },
    };

    expect(tree(await listAs(companyAdmin))).toEqual([
      { name: 'Platform news', hasRights: true },
    ]);
  });
});
