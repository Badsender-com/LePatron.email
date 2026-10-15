'use strict';

// Turning a company's preview links off suspends them: the share page checks
// the switch at every view, so nothing is revoked when it is saved, and the
// links open again if it is turned back on. Only a super admin holds it.

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
  it('saves the switch turned off, and revokes no link', async () => {
    storedSharing(true);
    await update(superAdmin, { enableShareLinks: false });
    expect(groupService.updateGroup.mock.calls[0][0]).toMatchObject({
      enableShareLinks: false,
    });
  });

  it('saves the switch turned back on', async () => {
    storedSharing(false);
    await update(superAdmin, { enableShareLinks: true });
    expect(groupService.updateGroup.mock.calls[0][0]).toMatchObject({
      enableShareLinks: true,
    });
  });

  it('leaves the switch to the super admin', async () => {
    storedSharing(true);
    await update(groupAdmin, { enableShareLinks: false });
    expect(groupService.updateGroup.mock.calls[0][0]).not.toHaveProperty(
      'enableShareLinks'
    );
  });
});
