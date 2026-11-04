'use strict';

// The MCP module (ADR 0017): what Badsender sells a company, opened and closed
// by a super admin like the other modules. MCP access stays the tech admin's
// switch; closing the module ends the company's connected applications.

// The mocked database and collaborators of the company update, shared with
// the tests of the company's switches; required before what it mocks.
const {
  storedGroup,
  update,
  GROUP_ID,
  superAdmin,
  companyAdmin,
  techAdmin,
} = require('./group-update.harness.js');
const {
  forgetConnections,
} = require('../../../packages/server/mcp/mcp-connections.js');

let saved;

function given(group) {
  saved = storedGroup(group);
}

beforeEach(() => {
  jest.clearAllMocks();
  given({ enableMcpModule: false, enableMcp: false });
});

// Turned on by #1396 (a closed module refuses the assistants)
describe.skip('PUT /groups/:groupId — MCP module', () => {
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

// Turned on by #1397 (closing it revokes, after a confirmation)
describe.skip('PUT /groups/:groupId — closing and opening the MCP module', () => {
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
