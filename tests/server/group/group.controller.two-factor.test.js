'use strict';

// A group requires two-factor authentication of all its members, or of none
// (epic #1318, ADR 0008): a tech admin or a super admin switches it, from a
// group update that keeps only a few fields from anyone but a super admin.

const createError = require('http-errors');
const {
  SecurityEvents,
  groupService,
  groupController,
  GROUP_ID,
  companyAdmin,
  techAdmin,
  superAdmin,
  storedGroup,
  update,
} = require('./group-update.harness.js');
const {
  ROLES,
  CAPABILITIES,
  roleCan,
} = require('../../../packages/shared/access/roles.js');
const {
  GUARD_GROUP_ADMIN,
} = require('../../../packages/server/account/auth.guard.js');

beforeEach(() => {
  jest.clearAllMocks();
  storedGroup({ requireTwoFactor: false });
});

describe('PUT /groups/:groupId — requireTwoFactor', () => {
  // The route lets only a group admin or a super admin in; the field is
  // decided for every role all the same.
  it.each(Object.values(ROLES))('decides the field for a %s', async (role) => {
    const payload = await update(
      { id: 'r1', role, group: GROUP_ID },
      { requireTwoFactor: true }
    );

    if (roleCan(role, CAPABILITIES.GROUP_MANAGE_TECH)) {
      expect(payload.requireTwoFactor).toBe(true);
    } else {
      expect(payload).not.toHaveProperty('requireTwoFactor');
    }
  });

  it('lets a tech admin require two-factor authentication', async () => {
    const payload = await update(techAdmin, { requireTwoFactor: true });

    expect(payload.requireTwoFactor).toBe(true);
  });

  it('lets a super admin require it', async () => {
    const payload = await update(superAdmin, { requireTwoFactor: true });

    expect(payload.requireTwoFactor).toBe(true);
  });

  it('drops it from a company admin, and records nothing', async () => {
    const payload = await update(companyAdmin, {
      requireTwoFactor: true,
      name: 'Renamed',
    });

    expect(payload).not.toHaveProperty('requireTwoFactor');
    expect(payload.name).toBe('Renamed');
    expect(SecurityEvents.create).not.toHaveBeenCalled();
  });

  it('drops a company admin switching it off', async () => {
    storedGroup({ requireTwoFactor: true });

    const payload = await update(companyAdmin, { requireTwoFactor: false });

    expect(payload).not.toHaveProperty('requireTwoFactor');
    expect(SecurityEvents.create).not.toHaveBeenCalled();
  });

  it('keeps a boolean, whatever the request carries', async () => {
    const payload = await update(techAdmin, { requireTwoFactor: 'yes' });

    expect(payload.requireTwoFactor).toBe(false);
  });

  it('records the option switched on, by whom', async () => {
    await update(techAdmin, { requireTwoFactor: true });

    expect(SecurityEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'two-factor.required',
        actor: 'a2',
        group: GROUP_ID,
      })
    );
  });

  it('records the option switched off', async () => {
    storedGroup({ requireTwoFactor: true });

    await update(techAdmin, { requireTwoFactor: false });

    expect(SecurityEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'two-factor.not-required' })
    );
  });

  it('records nothing when the option does not change', async () => {
    await update(techAdmin, { requireTwoFactor: false, name: 'Renamed' });

    expect(SecurityEvents.create).not.toHaveBeenCalled();
  });

  it('keeps a regular user out of the group update', () => {
    const next = jest.fn();

    GUARD_GROUP_ADMIN({ user: { id: 'u1', role: 'regular_user' } }, {}, next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(createError.Unauthorized);
  });
});

describe('GET /groups/:groupId/users — twoFactorMethod', () => {
  const member = {
    id: 'u1',
    name: 'Camille',
    twoFactorMethod: 'email',
    toJSON() {
      return { id: 'u1', name: 'Camille', twoFactorMethod: 'email' };
    },
  };

  async function readUsersAs(user) {
    groupService.findUserByGroupId.mockResolvedValue([member]);
    const res = { json: jest.fn() };
    await groupController.readUsers(
      { params: { groupId: GROUP_ID }, user },
      res
    );
    return res.json.mock.calls[0][0].items;
  }

  it('shows each member’s method to a company admin', async () => {
    const [item] = await readUsersAs(companyAdmin);

    expect(item.twoFactorMethod).toBe('email');
  });

  it('hides it from a member who does not manage the group', async () => {
    const [item] = await readUsersAs({
      id: 'u2',
      role: 'writer',
      group: GROUP_ID,
    });

    expect(item).toEqual({ id: 'u1', name: 'Camille' });
  });
});
