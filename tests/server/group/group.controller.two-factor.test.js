'use strict';

// A group requires two-factor authentication of all its members, or of none
// (epic #1318, ADR 0008): a company admin or a tech admin switches it, from a
// group update that otherwise keeps only a few fields from them.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Groups: { findById: jest.fn() },
  SecurityEvents: { create: jest.fn() },
  Profiles: {},
  Templates: {},
  Mailings: {},
}));
jest.mock('../../../packages/server/group/group.service.js', () => ({
  updateGroup: jest.fn(),
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

const createError = require('http-errors');
const {
  Groups,
  SecurityEvents,
} = require('../../../packages/server/common/models.common.js');
const groupService = require('../../../packages/server/group/group.service.js');
const groupController = require('../../../packages/server/group/group.controller.js');
const {
  GUARD_GROUP_ADMIN,
} = require('../../../packages/server/account/auth.guard.js');

const GROUP_ID = '507f1f77bcf86cd799439001';
const companyAdmin = { id: 'a1', role: 'company_admin', group: GROUP_ID };
const techAdmin = { id: 'a2', role: 'company_admin_tech', group: GROUP_ID };

function storedGroup(fields) {
  const group = { id: GROUP_ID, name: 'Client group', ...fields };
  Groups.findById.mockReturnValue({
    lean: jest.fn().mockResolvedValue(group),
    then: (resolve, reject) => Promise.resolve(group).then(resolve, reject),
  });
}

async function update(user, body) {
  await groupController.update(
    { params: { groupId: GROUP_ID }, body, user },
    { json: jest.fn() }
  );
  return groupService.updateGroup.mock.calls[0][0];
}

beforeEach(() => {
  jest.clearAllMocks();
  storedGroup({ requireTwoFactor: false });
});

// Turned on by #1320 (two-factor authentication with an authenticator app)
describe.skip('PUT /groups/:groupId — requireTwoFactor', () => {
  it('lets a company admin require two-factor authentication', async () => {
    const payload = await update(companyAdmin, { requireTwoFactor: true });

    expect(payload.requireTwoFactor).toBe(true);
  });

  it('lets a tech admin require it', async () => {
    const payload = await update(techAdmin, { requireTwoFactor: true });

    expect(payload.requireTwoFactor).toBe(true);
  });

  it('keeps a boolean, whatever the request carries', async () => {
    const payload = await update(companyAdmin, { requireTwoFactor: 'yes' });

    expect(payload.requireTwoFactor).toBe(false);
  });

  it('records the option switched on, by whom', async () => {
    await update(companyAdmin, { requireTwoFactor: true });

    expect(SecurityEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'two-factor.required',
        actor: 'a1',
        group: GROUP_ID,
      })
    );
  });

  it('records the option switched off', async () => {
    storedGroup({ requireTwoFactor: true });

    await update(companyAdmin, { requireTwoFactor: false });

    expect(SecurityEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'two-factor.not-required' })
    );
  });

  it('records nothing when the option does not change', async () => {
    await update(companyAdmin, { requireTwoFactor: false, name: 'Renamed' });

    expect(SecurityEvents.create).not.toHaveBeenCalled();
  });

  it('keeps a regular user out of the group update', () => {
    const next = jest.fn();

    GUARD_GROUP_ADMIN({ user: { id: 'u1', role: 'regular_user' } }, {}, next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(createError.Unauthorized);
  });
});
