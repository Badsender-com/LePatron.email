'use strict';

// The MCP module (ADR 0017): what the platform company sells a company,
// opened and closed by a super admin like the other modules. MCP access stays
// the tech admin's switch; closing the module ends the company's connected
// applications. The module is one of the company's switches (group-switch.js),
// under the rule of MCP access: a strict boolean, written in the operation
// that reads what it was, a security event when it changes, and the
// connections revoked whenever a request closes it.

const mongoose = require('mongoose');
const {
  Groups,
  SecurityEvents,
  groupService,
  GROUP_ID,
  techAdmin,
  superAdmin,
  storedGroup,
  update,
  guardRefusal,
} = require('./group-update.harness.js');
const {
  revokeConnections,
} = require('../../../packages/server/mcp/mcp-connections.js');
const {
  ROLES,
  CAPABILITIES,
  roleCan,
} = require('../../../packages/shared/access/roles.js');
const SecurityEventSchema = require('../../../packages/server/security-event/security-event.schema.js');

let saved;

function given(group) {
  saved = storedGroup(group);
}

const actions = () => SecurityEvents.create.mock.calls.map(([e]) => e.action);

beforeEach(() => {
  jest.clearAllMocks();
  given({ enableMcpModule: false, enableMcp: false });
});

describe('PUT /groups/:groupId — MCP module', () => {
  it('starts closed on a new group', () => {
    const GroupSchema = require('../../../packages/server/group/group.schema.js');
    const Group =
      mongoose.models.McpModuleGroup ||
      mongoose.model('McpModuleGroup', GroupSchema);

    expect(new Group({ name: 'New client' }).enableMcpModule).toBe(false);
  });

  it('lets a super admin open the MCP module, and close it', async () => {
    await update(superAdmin, { enableMcpModule: true });
    expect(saved.enableMcpModule).toBe(true);

    jest.clearAllMocks();
    await update(superAdmin, { enableMcpModule: false });
    expect(saved.enableMcpModule).toBe(false);
  });

  // Only a super admin changes it: the route lets a group admin through, and
  // the update drops the field for anyone who may not manage the platform.
  it.each(Object.values(ROLES))(
    'lets a %s change it only when it manages the platform',
    async (role) => {
      const user = { id: 'r1', role, group: GROUP_ID };

      const through = guardRefusal(user) === null;
      if (through) await update(user, { enableMcpModule: true });

      expect(saved.enableMcpModule).toBe(
        roleCan(role, CAPABILITIES.PLATFORM_MANAGE)
      );
    }
  );

  it('decides every role', () => {
    expect(Object.values(ROLES)).toHaveLength(6);
  });

  // Mongoose 5 casts what it is given to a boolean: `'yes'` or `1` would open
  // the module if the update carried them to the database.
  it.each([['yes'], ['true'], [1], [{ $ne: false }]])(
    'keeps a boolean when the request carries %p',
    async (value) => {
      await update(superAdmin, { enableMcpModule: value });

      expect(saved.enableMcpModule).toBe(false);
      expect(groupService.updateGroup.mock.calls[0][0]).not.toHaveProperty(
        'enableMcpModule'
      );
    }
  );

  it('writes it with the switches, never with the rest of the update', async () => {
    await update(superAdmin, { name: 'Renamed', enableMcpModule: true });

    expect(Groups.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: GROUP_ID },
      { $set: { enableMcpModule: true } },
      { new: false, projection: { enableMcpModule: 1 } }
    );
    expect(groupService.updateGroup).toHaveBeenCalledWith({
      name: 'Renamed',
      id: GROUP_ID,
    });
  });

  // The access a closed module gives is none, whatever the switch says.
  it("still takes the tech admin's MCP access while the module is closed", async () => {
    const payload = await update(techAdmin, { enableMcp: true });

    expect(payload.enableMcp).toBe(true);
  });
});

describe('PUT /groups/:groupId — MCP module, the security event', () => {
  it('records the module opened, by whom', async () => {
    await update(superAdmin, { enableMcpModule: true });

    expect(SecurityEvents.create).toHaveBeenCalledTimes(1);
    expect(SecurityEvents.create).toHaveBeenCalledWith({
      action: 'mcp-module.opened',
      actor: 'a3',
      group: GROUP_ID,
    });
  });

  it('records it closed', async () => {
    given({ enableMcpModule: true, enableMcp: true });

    await update(superAdmin, { enableMcpModule: false });

    expect(SecurityEvents.create).toHaveBeenCalledWith({
      action: 'mcp-module.closed',
      actor: 'a3',
      group: GROUP_ID,
    });
  });

  it.each([true, false])(
    'records nothing when it does not change (%p)',
    async (value) => {
      given({ enableMcpModule: value, enableMcp: true });

      await update(superAdmin, { enableMcpModule: value, name: 'Renamed' });

      expect(SecurityEvents.create).not.toHaveBeenCalled();
    }
  );

  it('judges the change by the value its own write replaced', async () => {
    Groups.findOneAndUpdate.mockReturnValue({
      lean: jest
        .fn()
        .mockResolvedValue({ _id: GROUP_ID, enableMcpModule: true }),
    });

    await update(superAdmin, { enableMcpModule: true });

    expect(SecurityEvents.create).not.toHaveBeenCalled();
  });

  it('records the module and MCP access apart when both change at once', async () => {
    await update(superAdmin, { enableMcpModule: true, enableMcp: true });

    expect(actions()).toEqual(['mcp-module.opened', 'mcp-access.enabled']);
  });

  it.each(['mcp-module.opened', 'mcp-module.closed'])(
    'is an action the security events accept: %s',
    (action) => {
      const SecurityEvent = mongoose.model(
        `McpModuleEvent-${action}`,
        SecurityEventSchema
      );
      const event = new SecurityEvent({ action, group: GROUP_ID });

      expect(event.validateSync()).toBeUndefined();
    }
  );
});

describe('PUT /groups/:groupId — closing and opening the MCP module', () => {
  it("revokes the group's connected applications when closed", async () => {
    given({ enableMcpModule: true, enableMcp: true });

    await update(superAdmin, { enableMcpModule: false });

    expect(revokeConnections).toHaveBeenCalledWith({ _company: GROUP_ID });
  });

  // As MCP access: a revocation that failed can be run again.
  it('revokes them whenever a request closes it, already closed or not, recording no event', async () => {
    await update(superAdmin, { enableMcpModule: false });

    expect(revokeConnections).toHaveBeenCalledWith({ _company: GROUP_ID });
    expect(SecurityEvents.create).not.toHaveBeenCalled();
  });

  it.each([
    ['opened', { enableMcpModule: true }],
    ['not in the request', { name: 'Renamed' }],
  ])('revokes nothing when it is %s', async (_case, body) => {
    given({ enableMcpModule: true, enableMcp: true });

    await update(superAdmin, body);

    expect(revokeConnections).not.toHaveBeenCalled();
  });

  it('revokes nothing when a tech admin sends it, the field dropped', async () => {
    given({ enableMcpModule: true, enableMcp: true });

    await update(techAdmin, { enableMcpModule: false });

    expect(saved.enableMcpModule).toBe(true);
    expect(revokeConnections).not.toHaveBeenCalled();
  });

  it('keeps MCP access as the company set it when closed', async () => {
    given({ enableMcpModule: true, enableMcp: true });

    await update(superAdmin, { enableMcpModule: false });

    expect(saved.enableMcp).toBe(true);
  });

  it('leaves MCP access off when opened', async () => {
    await update(superAdmin, { enableMcpModule: true });

    expect(saved.enableMcp).toBe(false);
    expect(actions()).toEqual(['mcp-module.opened']);
  });
});
