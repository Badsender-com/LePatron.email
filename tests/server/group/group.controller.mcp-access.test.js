'use strict';

// MCP access (ADR 0012): the company's switch, which a super admin turns on
// for any company and a tech admin for its own, as it sets up the company's
// AI features. The group update keeps it out of a company admin's reach, as
// every field it may not set, and the route keeps every other company's
// members out.

const createError = require('http-errors');
const {
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
