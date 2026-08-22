'use strict';

// PUT /groups/:groupId strips the payload down to a whitelist when the caller is a
// company admin. `emailMetadata` has to be on that list, otherwise the settings
// page saves without error and changes nothing — the exact kind of omission that
// review does not catch and that only shows up as "the switch won't stay on".
//
// Also pinned: the payload goes through sanitizeEmailMetadata before reaching the
// service, so a hand-crafted request cannot store an arbitrary shape.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Groups: { findById: jest.fn() },
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

const { Groups } = require('../../../packages/server/common/models.common.js');
const groupService = require('../../../packages/server/group/group.service.js');
const groupController = require('../../../packages/server/group/group.controller.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

const GROUP_ID = '507f1f77bcf86cd799439001';

function makeRes() {
  return { json: jest.fn() };
}

async function update({ user, body }) {
  const res = makeRes();
  await groupController.update(
    { params: { groupId: GROUP_ID }, body, user },
    res
  );
  return { res, payload: groupService.updateGroup.mock.calls[0][0] };
}

beforeEach(() => {
  jest.clearAllMocks();
  Groups.findById.mockResolvedValue({ id: GROUP_ID, name: 'Company A' });
});

describe('PUT /groups/:groupId — emailMetadata, company admin', () => {
  const groupAdmin = { isGroupAdmin: true, isAdmin: false };

  it('lets emailMetadata through the whitelist', async () => {
    const { payload } = await update({
      user: groupAdmin,
      body: { emailMetadata: { enabled: true, requiredFields: ['subject'] } },
    });

    expect(payload.emailMetadata).toEqual({
      enabled: true,
      requiredFields: ['subject'],
    });
  });

  it('still strips the fields reserved to the super admin', async () => {
    const { payload } = await update({
      user: groupAdmin,
      body: {
        emailMetadata: { enabled: true },
        enableEmailBuilder: false,
        cdnEndPoint: 'https://attacker.example',
      },
    });

    expect(payload).not.toHaveProperty('enableEmailBuilder');
    expect(payload).not.toHaveProperty('cdnEndPoint');
  });

  it('sanitizes before persisting: unknown keys never reach the service', async () => {
    const { payload } = await update({
      user: groupAdmin,
      body: {
        emailMetadata: {
          enabled: 'yes',
          requiredFields: ['plannedSendDate'],
          sneaky: true,
        },
      },
    });

    expect(payload.emailMetadata).toEqual({
      enabled: true,
      requiredFields: ['plannedSendDate'],
    });
  });

  it('refuses an unknown required field rather than storing it', async () => {
    await expect(
      update({
        user: groupAdmin,
        body: { emailMetadata: { requiredFields: ['language'] } },
      })
    ).rejects.toThrow(ERROR_CODES.INVALID_EMAIL_METADATA);

    expect(groupService.updateGroup).not.toHaveBeenCalled();
  });

  it('turns an explicit null into the default sub-object, not a stored null', async () => {
    const { payload } = await update({
      user: groupAdmin,
      body: { emailMetadata: null },
    });

    expect(payload.emailMetadata).toEqual({
      enabled: false,
      requiredFields: [],
    });
  });

  it('leaves the payload alone when it carries no emailMetadata', async () => {
    const { payload } = await update({
      user: groupAdmin,
      body: { name: 'Renamed' },
    });

    expect(payload).not.toHaveProperty('emailMetadata');
    expect(payload.name).toBe('Renamed');
  });
});

describe('PUT /groups/:groupId — the URL names the group being updated', () => {
  // The route guard only ever checked `req.params.groupId`, so that is the only
  // id allowed to reach the update.
  it.each([
    ['company admin', { isGroupAdmin: true, isAdmin: false }],
    ['super admin', { isGroupAdmin: false, isAdmin: true }],
  ])('ignores an id supplied in the body (%s)', async (_label, user) => {
    const { payload } = await update({
      user,
      body: {
        id: '507f1f77bcf86cd7994390ff',
        name: 'Renamed',
        emailMetadata: { enabled: true },
      },
    });

    expect(payload.id).toBe(GROUP_ID);
  });
});

describe('PUT /groups/:groupId — emailMetadata, super admin', () => {
  it('goes through without the whitelist, still sanitized', async () => {
    const { payload } = await update({
      user: { isGroupAdmin: false, isAdmin: true },
      body: {
        enableEmailBuilder: false,
        emailMetadata: { enabled: true, requiredFields: ['  subject  '] },
      },
    });

    expect(payload.enableEmailBuilder).toBe(false);
    expect(payload.emailMetadata).toEqual({
      enabled: true,
      requiredFields: ['subject'],
    });
  });
});
