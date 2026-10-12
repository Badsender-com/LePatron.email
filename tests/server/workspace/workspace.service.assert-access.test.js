'use strict';

// Writing in a workspace: the workspace of one's own company, as a member or a
// company admin; an admin, who creates no mailing, nowhere. `assertAccess` throws where `hasAccess`
// answers, so a caller cannot forget to read the answer.

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
const outsider = { id: 'u2', group: { id: COMPANY_B } };
const companyAdminOfB = { ...outsider, isGroupAdmin: true };
const admin = { id: 'admin', isAdmin: true };

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

  it('refuses an admin, without a group, with an answer rather than a crash', async () => {
    await expect(
      workspaceService.assertAccess(admin, WORKSPACE)
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
