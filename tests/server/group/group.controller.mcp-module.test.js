'use strict';

// The MCP module (ADR 0017): what Badsender sells a company, opened and closed
// by a super admin like the other modules. MCP access stays the tech admin's
// switch; closing the module ends the company's connected applications.

jest.mock('../../../packages/server/mcp/mcp-connections.js', () => ({
  forgetConnections: jest.fn(),
}));
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
jest.mock(
  '../../../packages/server/ai-skill/services/invocation-log.service.js',
  () => ({ restampRetention: jest.fn() })
);
jest.mock('../../../packages/server/mcp/mcp-retention.js', () => ({
  restampMcpRetention: jest.fn(),
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
const {
  forgetConnections,
} = require('../../../packages/server/mcp/mcp-connections.js');

const GROUP_ID = '507f1f77bcf86cd799439001';
const superAdmin = { id: 's1', role: 'super_admin', group: 'platform' };
const companyAdmin = { id: 'a1', role: 'company_admin', group: GROUP_ID };
const techAdmin = { id: 'a2', role: 'company_admin_tech', group: GROUP_ID };

let saved;

async function update(user, body) {
  await groupController.update(
    { params: { groupId: GROUP_ID }, body, user },
    { json: jest.fn() }
  );
  return groupService.updateGroup.mock.calls[0][0];
}

function given(group) {
  saved = { id: GROUP_ID, name: 'Client group', ...group };
  // The group as saved: what the controller reads back.
  groupService.updateGroup.mockImplementation(async (changes) =>
    Object.assign(saved, changes)
  );
  Groups.findById.mockReturnValue({
    lean: jest.fn().mockResolvedValue(saved),
    then: (resolve, reject) => Promise.resolve(saved).then(resolve, reject),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  given({ enableMcpModule: false, enableMcp: false });
});

describe('PUT /groups/:groupId — MCP module', () => {
  it('starts closed on a new group', () => {
    const mongoose = require('mongoose');
    const GroupSchema = require('../../../packages/server/group/group.schema.js');
    const Group =
      mongoose.models.McpModuleGroup ||
      mongoose.model('McpModuleGroup', GroupSchema);

    expect(new Group({ name: 'New client' }).enableMcpModule).toBe(false);
  });

  it('lets a super admin open the MCP module, and close it', async () => {
    expect(
      (await update(superAdmin, { enableMcpModule: true })).enableMcpModule
    ).toBe(true);
    jest.clearAllMocks();
    expect(
      (await update(superAdmin, { enableMcpModule: false })).enableMcpModule
    ).toBe(false);
  });

  it.each([
    ['a tech admin', techAdmin],
    ['a company admin', companyAdmin],
  ])('keeps it out of the reach of %s', async (_case, user) => {
    const payload = await update(user, {
      name: 'Renamed',
      enableMcpModule: true,
    });

    expect(payload).not.toHaveProperty('enableMcpModule');
    expect(payload.name).toBe('Renamed');
  });

  // The access a closed module gives is none, whatever the switch says.
  it("still takes the tech admin's MCP access while the module is closed", async () => {
    const payload = await update(techAdmin, { enableMcp: true });

    expect(payload.enableMcp).toBe(true);
  });
});

describe('PUT /groups/:groupId — closing and opening the MCP module', () => {
  it("revokes the group's connected applications when closed", async () => {
    given({ enableMcpModule: true, enableMcp: true });

    await update(superAdmin, { enableMcpModule: false });

    expect(forgetConnections).toHaveBeenCalledWith({ _company: GROUP_ID });
  });

  it('revokes nothing when opened', async () => {
    await update(superAdmin, { enableMcpModule: true });

    expect(forgetConnections).not.toHaveBeenCalled();
  });

  it('keeps MCP access as the company set it when closed', async () => {
    given({ enableMcpModule: true, enableMcp: true });

    await update(superAdmin, { enableMcpModule: false });

    expect(saved.enableMcp).toBe(true);
  });

  it('leaves MCP access off when opened', async () => {
    await update(superAdmin, { enableMcpModule: true });

    expect(saved.enableMcp).toBe(false);
  });
});
