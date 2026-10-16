'use strict';

// Writing in a workspace: the workspace of one's own company, as a member or a
// company admin; a super admin in any workspace; the bootstrap account, which
// stays in the settings, in none (ADR 0002, amended).
// `assertAccess` throws where `hasAccess` answers, so a caller cannot forget
// to read the answer.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Workspaces: { exists: jest.fn(), findById: jest.fn() },
  Groups: {},
  Folders: {},
  Mailings: {},
  Users: {},
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  Workspaces,
} = require('../../../packages/server/common/models.common.js');
const workspaceService = require('../../../packages/server/workspace/workspace.service.js');

const WORKSPACE = '507f1f77bcf86cd799439011';
const COMPANY_A = '507f1f77bcf86cd799439001';
const COMPANY_B = '507f1f77bcf86cd799439002';

const member = { id: 'u1', group: { id: COMPANY_A } };
const colleague = { id: 'u3', group: { id: COMPANY_A } };
const companyAdminOfA = {
  ...colleague,
  role: 'company_admin',
  isGroupAdmin: true,
};
const outsider = { id: 'u2', group: { id: COMPANY_B } };
const companyAdminOfB = {
  ...outsider,
  role: 'company_admin',
  isGroupAdmin: true,
};

beforeEach(() => {
  Workspaces.exists.mockResolvedValue(true);
  Workspaces.findById.mockReturnValue({
    populate: jest.fn().mockResolvedValue({
      _id: WORKSPACE,
      group: COMPANY_A,
      _users: ['u1'],
    }),
  });
});

describe('assertAccess', () => {
  it('lets a member of the workspace write in it', async () => {
    await expect(
      workspaceService.assertAccess(member, WORKSPACE)
    ).resolves.toBeUndefined();
  });

  it('lets a company admin of the company write in it, member or not', async () => {
    await expect(
      workspaceService.assertAccess(companyAdminOfA, WORKSPACE)
    ).resolves.toBeUndefined();
  });

  it('refuses a user of the company who is not a member', async () => {
    await expect(
      workspaceService.assertAccess(colleague, WORKSPACE)
    ).rejects.toMatchObject({ status: 404 });
  });

  it('refuses a user of another company', async () => {
    await expect(
      workspaceService.assertAccess(outsider, WORKSPACE)
    ).rejects.toMatchObject({ status: 404 });
  });

  it('refuses a company admin of another company', async () => {
    await expect(
      workspaceService.assertAccess(companyAdminOfB, WORKSPACE)
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('assertAccess for a super admin (ADR 0002, amended)', () => {
  const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';
  const superAdmin = {
    id: 'alice',
    role: 'super_admin',
    isAdmin: true,
    group: { id: PLATFORM_GROUP },
    selectedGroup: { id: COMPANY_A },
  };

  it('lets a super admin write in the workspace of a client company, member or not', async () => {
    await expect(
      workspaceService.assertAccess(superAdmin, WORKSPACE)
    ).resolves.toBeUndefined();
  });

  it('lets a super admin write there whatever group it has selected: a write takes the group of its destination', async () => {
    const elsewhere = { ...superAdmin, selectedGroup: { id: COMPANY_B } };

    await expect(
      workspaceService.assertAccess(elsewhere, WORKSPACE)
    ).resolves.toBeUndefined();
  });

  it('refuses the bootstrap account, which stays in the settings', async () => {
    const { bootstrap } = require('../../helpers/super-admin-fixtures.js');

    await expect(
      workspaceService.assertAccess({ ...bootstrap }, WORKSPACE)
    ).rejects.toMatchObject({ status: 403 });
  });

  it('still refuses a company admin of another company', async () => {
    await expect(
      workspaceService.assertAccess(companyAdminOfB, WORKSPACE)
    ).rejects.toMatchObject({ status: 404 });
  });
});
