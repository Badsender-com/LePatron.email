'use strict';

// MCP access (ADR 0012): the company's switch, which a super admin turns on
// for any company and a tech admin for its own, as it sets up the company's
// AI features. The group update keeps it out of a company admin's reach, as
// every field it may not set, and the route keeps every other company's
// members out. Turning it on or off is a security event, as switching
// two-factor authentication is (ADR 0008).

const createError = require('http-errors');
const mongoose = require('mongoose');
const {
  Groups,
  SecurityEvents,
  groupService,
  GROUP_ID,
  companyAdmin,
  techAdmin,
  superAdmin,
  otherTechAdmin,
  storedGroup,
  update,
  guardRefusal,
} = require('./group-update.harness.js');
const {
  ROLES,
  CAPABILITIES,
  roleCan,
} = require('../../../packages/shared/access/roles.js');
const SecurityEventSchema = require('../../../packages/server/security-event/security-event.schema.js');
const {
  restampMcpRetention,
} = require('../../../packages/server/mcp/mcp-retention.js');

beforeEach(() => {
  jest.clearAllMocks();
  storedGroup({ enableMcp: false });
});

describe('PUT /groups/:groupId — MCP access', () => {
  // The route lets only a group admin or a super admin in; the field is
  // decided for every role all the same.
  it.each(Object.values(ROLES))('decides the field for a %s', async (role) => {
    const payload = await update(
      { id: 'r1', role, group: GROUP_ID },
      { enableMcp: true }
    );

    if (roleCan(role, CAPABILITIES.GROUP_MANAGE_TECH)) {
      expect(payload.enableMcp).toBe(true);
    } else {
      expect(payload).not.toHaveProperty('enableMcp');
    }
  });

  it.each(Object.values(ROLES))(
    'lets a %s of the company through the route only when it manages the company',
    (role) => {
      const refusal = guardRefusal({ id: 'r1', role, group: GROUP_ID });

      if (roleCan(role, CAPABILITIES.GROUP_MANAGE)) {
        expect(refusal).toBeNull();
      } else {
        expect(refusal).toBeInstanceOf(createError.Unauthorized);
      }
    }
  );

  it('lets a super admin turn MCP access on', async () => {
    const payload = await update(superAdmin, { enableMcp: true });

    expect(payload.enableMcp).toBe(true);
  });

  it('lets a tech admin turn it on, and off', async () => {
    expect((await update(techAdmin, { enableMcp: true })).enableMcp).toBe(true);
    jest.clearAllMocks();
    storedGroup({ enableMcp: true });
    expect((await update(techAdmin, { enableMcp: false })).enableMcp).toBe(
      false
    );
  });

  it('keeps it out of the reach of a company admin', async () => {
    const payload = await update(companyAdmin, {
      name: 'Renamed',
      enableMcp: true,
    });

    expect(payload).not.toHaveProperty('enableMcp');
    expect(payload.name).toBe('Renamed');
  });

  it('keeps the tech admin of another company out of the route', () => {
    expect(guardRefusal(otherTechAdmin)).toBeInstanceOf(
      createError.Unauthorized
    );
  });

  it.each([['yes'], ['true'], [1], [{ $ne: false }]])(
    'keeps a boolean when the request carries %p',
    async (value) => {
      const payload = await update(techAdmin, { enableMcp: value });

      expect(payload.enableMcp).toBe(false);
    }
  );

  it('leaves the field alone when the request does not carry it', async () => {
    const payload = await update(techAdmin, { name: 'Renamed' });

    expect(payload).not.toHaveProperty('enableMcp');
    expect(groupService.updateGroup).toHaveBeenCalledTimes(1);
  });
});

describe('PUT /groups/:groupId — MCP access, the security event', () => {
  it('records MCP access turned on, by whom', async () => {
    await update(techAdmin, { enableMcp: true });

    expect(SecurityEvents.create).toHaveBeenCalledTimes(1);
    expect(SecurityEvents.create).toHaveBeenCalledWith({
      action: 'mcp-access.enabled',
      actor: 'a2',
      group: GROUP_ID,
    });
  });

  it('records it turned off', async () => {
    storedGroup({ enableMcp: true });

    await update(superAdmin, { enableMcp: false });

    expect(SecurityEvents.create).toHaveBeenCalledWith({
      action: 'mcp-access.disabled',
      actor: 'a3',
      group: GROUP_ID,
    });
  });

  it('records nothing when it does not change', async () => {
    await update(techAdmin, { enableMcp: false, name: 'Renamed' });

    expect(SecurityEvents.create).not.toHaveBeenCalled();
  });

  it('records nothing from a company admin, whose request drops it', async () => {
    await update(companyAdmin, { enableMcp: true });

    expect(SecurityEvents.create).not.toHaveBeenCalled();
  });

  it('records each switch apart when both change at once', async () => {
    await update(techAdmin, { enableMcp: true, requireTwoFactor: true });

    const actions = SecurityEvents.create.mock.calls.map(([e]) => e.action);
    expect(actions).toEqual(['two-factor.required', 'mcp-access.enabled']);
  });

  // The change is the one the write made: the value it replaced, read in
  // the same operation, decides it.
  it('judges the change by the value its own write replaced', async () => {
    storedGroup({ enableMcp: false });
    Groups.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: GROUP_ID, enableMcp: true }),
    });

    await update(techAdmin, { enableMcp: true });

    expect(SecurityEvents.create).not.toHaveBeenCalled();
  });

  it('reads and writes the switches at once, on their fields only', async () => {
    await update(techAdmin, {
      name: 'Renamed',
      enableMcp: true,
      requireTwoFactor: true,
    });

    expect(Groups.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(Groups.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: GROUP_ID },
      { $set: { requireTwoFactor: true, enableMcp: true } },
      {
        new: false,
        projection: { requireTwoFactor: 1, enableMcp: 1 },
      }
    );
    expect(groupService.updateGroup).toHaveBeenCalledWith({
      name: 'Renamed',
      id: GROUP_ID,
    });
  });

  it('writes no switch when the request carries none', async () => {
    await update(techAdmin, { name: 'Renamed' });

    expect(Groups.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each(['mcp-access.enabled', 'mcp-access.disabled'])(
    'is an action the security events accept: %s',
    (action) => {
      const SecurityEvent = mongoose.model(
        `McpAccessEvent-${action}`,
        SecurityEventSchema
      );
      const event = new SecurityEvent({ action, group: GROUP_ID });

      expect(event.validateSync()).toBeUndefined();
    }
  );
});

describe('PUT /groups/:groupId — retex', () => {
  it.each([
    ['a company admin', companyAdmin],
    ['a tech admin', techAdmin],
    ['a super admin', superAdmin],
  ])('lets %s allow the retex of the group', async (_case, user) => {
    const payload = await update(user, { allowRetex: true });

    expect(payload.allowRetex).toBe(true);
  });
});

describe('PUT /groups/:groupId — log retention', () => {
  it('reaches the MCP call logs and feedbacks already kept', async () => {
    await update(superAdmin, { logRetentionDays: 7 });

    expect(restampMcpRetention).toHaveBeenCalledWith({
      groupId: GROUP_ID,
      retentionDays: 7,
    });
  });
});
