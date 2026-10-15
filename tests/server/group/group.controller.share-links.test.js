'use strict';

// A super admin turns a company's preview links off to stop one that leaked:
// the links must be gone, not suspended until the switch is turned back on.

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
jest.mock('../../../packages/server/share-link/share-link.service.js', () => ({
  revokeAllForCompany: jest.fn(),
}));

const { Groups } = require('../../../packages/server/common/models.common.js');
const groupService = require('../../../packages/server/group/group.service.js');
const shareLinkService = require('../../../packages/server/share-link/share-link.service.js');
const groupController = require('../../../packages/server/group/group.controller.js');

const GROUP_ID = '507f1f77bcf86cd799439001';
const superAdmin = { isAdmin: true, isGroupAdmin: false };
const groupAdmin = { isAdmin: false, isGroupAdmin: true };

function storedSharing(enableShareLinks) {
  Groups.findById.mockReturnValue({
    lean: jest.fn().mockResolvedValue({ id: GROUP_ID, enableShareLinks }),
  });
}

async function update(user, body) {
  const res = { json: jest.fn() };
  await groupController.update(
    { params: { groupId: GROUP_ID }, body, user },
    res
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PUT /groups/:groupId — preview links', () => {
  it('revokes the active links when sharing is turned off, before saving', async () => {
    storedSharing(true);
    const order = [];
    shareLinkService.revokeAllForCompany.mockImplementation(async () =>
      order.push('revoke')
    );
    groupService.updateGroup.mockImplementation(async () => order.push('save'));

    await update(superAdmin, { enableShareLinks: false });

    expect(shareLinkService.revokeAllForCompany).toHaveBeenCalledWith(GROUP_ID);
    expect(order).toEqual(['revoke', 'save']);
  });

  it('revokes them for a company that predates the switch', async () => {
    storedSharing(undefined);
    await update(superAdmin, { enableShareLinks: false });
    expect(shareLinkService.revokeAllForCompany).toHaveBeenCalledTimes(1);
  });

  it('saves nothing when the links cannot be revoked', async () => {
    storedSharing(true);
    shareLinkService.revokeAllForCompany.mockRejectedValue(new Error('down'));
    await expect(
      update(superAdmin, { enableShareLinks: false })
    ).rejects.toThrow('down');
    expect(groupService.updateGroup).not.toHaveBeenCalled();
  });

  it('revokes nothing when sharing stays off, is turned on, or is not sent', async () => {
    storedSharing(false);
    await update(superAdmin, { enableShareLinks: false });
    storedSharing(false);
    await update(superAdmin, { enableShareLinks: true });
    storedSharing(true);
    await update(superAdmin, { name: 'Acme' });
    expect(shareLinkService.revokeAllForCompany).not.toHaveBeenCalled();
  });

  it('leaves the switch to the super admin', async () => {
    storedSharing(true);
    await update(groupAdmin, { enableShareLinks: false });
    expect(shareLinkService.revokeAllForCompany).not.toHaveBeenCalled();
    expect(groupService.updateGroup.mock.calls[0][0]).not.toHaveProperty(
      'enableShareLinks'
    );
  });
});
