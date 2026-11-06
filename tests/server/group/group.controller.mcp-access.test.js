'use strict';

// MCP access (ADR 0012): the company's switch, which a super admin turns on
// for any company and a tech admin for its own, as it sets up the company's
// AI features. The group update keeps it out of a company admin's reach, as
// every field it may not set, and the route keeps every other company's
// members out. Turning it on or off is a security event, as switching
// two-factor authentication is (ADR 0008), and so is allowing the retex.

const createError = require('http-errors');
const mongoose = require('mongoose');
const {
  Groups,
  SecurityEvents,
  McpFeedbacks,
  groupService,
  groupController,
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
  restampLogs,
} = require('../../../packages/server/group/log-retention.js');
const logger = require('../../../packages/server/utils/logger.js');
const {
  forgetRetention,
} = require('../../../packages/server/mcp/mcp-call-log.js');

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
  // Who allows the retex (ADR 0012, #1302): the company admin, the tech admin
  // and the super admin; no other role, which the route keeps out.
  it.each([
    [ROLES.SUPER_ADMIN, true],
    [ROLES.GROUP_ADMIN_TECH, true],
    [ROLES.GROUP_ADMIN, true],
    [ROLES.REGULAR_USER, false],
    [ROLES.WRITER, false],
    [ROLES.REVIEWER, false],
  ])('lets a %s allow the retex: %p', async (role, allowed) => {
    const user = { id: 'r1', role, group: GROUP_ID };

    const through = guardRefusal(user) === null;
    const payload = through ? await update(user, { allowRetex: true }) : {};

    expect(through && payload.allowRetex === true).toBe(allowed);
  });

  it('decides every role', () => {
    expect(Object.values(ROLES)).toHaveLength(6);
  });

  // A switch of the company, as MCP access: a strict boolean, written apart
  // from the rest of the update.
  it.each([['yes'], ['true'], [1], [{ $ne: false }]])(
    'keeps a boolean when the request carries %p',
    async (value) => {
      const payload = await update(techAdmin, { allowRetex: value });

      expect(payload.allowRetex).toBe(false);
    }
  );

  it('writes it with the switches, never with the rest of the update', async () => {
    await update(techAdmin, { name: 'Renamed', allowRetex: true });

    expect(Groups.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: GROUP_ID },
      { $set: { allowRetex: true } },
      { new: false, projection: { allowRetex: 1 } }
    );
    expect(groupService.updateGroup).toHaveBeenCalledWith({
      name: 'Renamed',
      id: GROUP_ID,
    });
  });
});

describe('PUT /groups/:groupId — retex, the security event', () => {
  it('records the retex allowed, by whom', async () => {
    await update(techAdmin, { allowRetex: true });

    expect(SecurityEvents.create).toHaveBeenCalledTimes(1);
    expect(SecurityEvents.create).toHaveBeenCalledWith({
      action: 'retex.allowed',
      actor: 'a2',
      group: GROUP_ID,
    });
  });

  it('records it stopped', async () => {
    storedGroup({ allowRetex: true });

    await update(superAdmin, { allowRetex: false });

    expect(SecurityEvents.create).toHaveBeenCalledWith({
      action: 'retex.disallowed',
      actor: 'a3',
      group: GROUP_ID,
    });
  });

  it('records nothing when it does not change', async () => {
    storedGroup({ allowRetex: true });

    await update(techAdmin, { allowRetex: true, name: 'Renamed' });

    expect(SecurityEvents.create).not.toHaveBeenCalled();
  });

  it.each(['retex.allowed', 'retex.disallowed'])(
    'is an action the security events accept: %s',
    (action) => {
      const SecurityEvent = mongoose.model(
        `RetexEvent-${action}`,
        SecurityEventSchema
      );
      const event = new SecurityEvent({ action, group: GROUP_ID });

      expect(event.validateSync()).toBeUndefined();
    }
  );
});

// Stopping the retex forgets what it let the feedbacks keep (ADR 0012): the
// summaries, and the comments longer than they may be without it. Whenever a
// request says it is off, so a forgetting that failed runs again; the
// security event records the change only.
describe('PUT /groups/:groupId — retex stopped', () => {
  const forgotten = () =>
    expect(McpFeedbacks.updateMany).toHaveBeenCalledWith(
      { _company: GROUP_ID, retex: { $ne: null } },
      { $set: { retex: null } }
    );

  it('forgets the session summaries kept for the company, and cuts the long comments', async () => {
    storedGroup({ allowRetex: true });

    await update(techAdmin, { allowRetex: false });

    forgotten();
    expect(McpFeedbacks.find).toHaveBeenCalledWith(
      { _company: GROUP_ID, comment: { $regex: '^[\\s\\S]{501}' } },
      { comment: 1 }
    );
  });

  it('forgets them again when it is already stopped, recording no event', async () => {
    storedGroup({ allowRetex: false });

    await update(techAdmin, { allowRetex: false });

    forgotten();
    expect(SecurityEvents.create).not.toHaveBeenCalled();
  });

  it.each([
    ['allowed', { allowRetex: false }, { allowRetex: true }],
    ['not in the request', { allowRetex: true }, { name: 'Renamed' }],
  ])('forgets nothing when it is %s', async (_case, stored, body) => {
    storedGroup(stored);

    await update(techAdmin, body);

    expect(McpFeedbacks.updateMany).not.toHaveBeenCalled();
  });
});

// A retention change reaches the logs already kept (group/log-retention.js),
// after the answer, which does not wait for it.
describe('PUT /groups/:groupId — log retention', () => {
  it('reaches every log already kept, once', async () => {
    await update(superAdmin, { logRetentionDays: 7 });

    expect(restampLogs).toHaveBeenCalledTimes(1);
    expect(restampLogs).toHaveBeenCalledWith(GROUP_ID);
  });

  // The call logs written from now on take the new retention at once.
  it('forgets the retention the call log keeps for the company', async () => {
    await update(superAdmin, { logRetentionDays: 7 });

    expect(forgetRetention).toHaveBeenCalledWith(GROUP_ID);
  });

  it('answers without waiting for the logs', async () => {
    restampLogs.mockReturnValueOnce(new Promise(() => {}));
    const res = { json: jest.fn() };

    await groupController.update(
      {
        params: { groupId: GROUP_ID },
        body: { logRetentionDays: 7 },
        user: superAdmin,
      },
      res
    );

    expect(res.json).toHaveBeenCalledTimes(1);
  });

  it('logs a failure to reach them', async () => {
    restampLogs.mockReturnValueOnce(Promise.reject(new Error('timed out')));

    await update(superAdmin, { logRetentionDays: 7 });
    await new Promise(setImmediate);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('retention'),
      expect.any(Error)
    );
  });

  it('touches nothing when the retention does not change', async () => {
    storedGroup({ logRetentionDays: 7 });

    await update(superAdmin, { logRetentionDays: 7 });

    expect(restampLogs).not.toHaveBeenCalled();
    expect(forgetRetention).not.toHaveBeenCalled();
  });
});
