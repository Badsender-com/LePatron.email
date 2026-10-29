'use strict';

// MCP access is a subscription (ADR 0012): a super admin turns it on for a
// group, and the group update keeps it out of a company admin's or a tech
// admin's reach, as it keeps every field they may not set.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Groups: { findById: jest.fn() },
  SecurityEvents: { create: jest.fn() },
  Profiles: {},
  Templates: {},
  Mailings: {},
}));
jest.mock('../../../packages/server/group/group.service.js', () => ({
  updateGroup: jest.fn(),
  findUserByGroupId: jest.fn(),
}));
jest.mock('../../../packages/server/profile/profile.service.js', () => ({}));
jest.mock(
  '../../../packages/server/emails-group/emails-group.service.js',
  () => ({})
);
jest.mock(
  '../../../packages/server/personalized-variables/personalized-variable.service.js',
  () => ({})
);
jest.mock('../../../packages/server/group/group-ftp.service.js', () => ({
  processCredentialsForUpdate: jest.fn((body) => ({ ...body })),
  validateSshKeyOrThrow: jest.fn(),
  maskFtpCredentials: jest.fn((group) => group),
}));
jest.mock('../../../packages/server/workspace/workspace.service.js', () => ({
  createWorkspace: jest.fn(),
  findWorkspaces: jest.fn(),
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const groupService = require('../../../packages/server/group/group.service.js');
const groupController = require('../../../packages/server/group/group.controller.js');
const { Groups } = require('../../../packages/server/common/models.common.js');

const GROUP_ID = '507f1f77bcf86cd799439001';
const superAdmin = { id: 's1', role: 'super_admin', group: 'platform' };
const companyAdmin = { id: 'a1', role: 'company_admin', group: GROUP_ID };
const techAdmin = { id: 'a2', role: 'company_admin_tech', group: GROUP_ID };

async function update(user, body) {
  await groupController.update(
    { params: { groupId: GROUP_ID }, body, user },
    { json: jest.fn() }
  );
  return groupService.updateGroup.mock.calls[0][0];
}

beforeEach(() => {
  jest.clearAllMocks();
  const group = { id: GROUP_ID, name: 'Client group', enableMcp: false };
  Groups.findById.mockReturnValue({
    lean: jest.fn().mockResolvedValue(group),
    then: (resolve, reject) => Promise.resolve(group).then(resolve, reject),
  });
});

describe('PUT /groups/:groupId — MCP access', () => {
  it('lets a super admin turn MCP access on', async () => {
    const payload = await update(superAdmin, { enableMcp: true });

    expect(payload.enableMcp).toBe(true);
  });

  it.each([
    ['a company admin', companyAdmin],
    ['a tech admin', techAdmin],
  ])('keeps it out of the reach of %s', async (_case, user) => {
    const payload = await update(user, { name: 'Renamed', enableMcp: true });

    expect(payload).not.toHaveProperty('enableMcp');
    expect(payload.name).toBe('Renamed');
  });
});
