'use strict';

// Editing a mailing needs the right to write in its workspace or folder, on
// top of the capability. `userCanEditMailing` gives the editor that answer, so
// it locks itself where a save would be refused.

jest.mock('../../../packages/server/common/models.common', () => ({
  Mailings: {},
  Galleries: {},
  Groups: {},
  Workspaces: {},
  Folders: {},
  Tags: {},
  Users: {},
  Templates: {},
}));
jest.mock('../../../packages/server/workspace/workspace.service.js', () => ({
  hasAccess: jest.fn(),
}));
jest.mock('../../../packages/server/folder/folder.service.js', () => ({
  hasAccess: jest.fn(),
}));
jest.mock('../../../packages/server/template/template.service.js', () => ({}));
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { NotFound } = require('http-errors');
const workspaceService = require('../../../packages/server/workspace/workspace.service.js');
const folderService = require('../../../packages/server/folder/folder.service.js');
const mailingService = require('../../../packages/server/mailing/mailing.service');

const member = { id: 'u1', group: { id: 'company-a' } };
const inWorkspace = { _workspace: 'w1' };
const inFolder = { _parentFolder: 'f1' };

beforeEach(() => jest.clearAllMocks());

describe('userCanEditMailing', () => {
  it('answers yes to whoever may write in the workspace', async () => {
    workspaceService.hasAccess.mockResolvedValue(true);

    await expect(
      mailingService.userCanEditMailing(member, inWorkspace)
    ).resolves.toBe(true);
    expect(workspaceService.hasAccess).toHaveBeenCalledWith(member, 'w1');
  });

  it('answers no to a member who may only read the workspace', async () => {
    workspaceService.hasAccess.mockResolvedValue(false);

    await expect(
      mailingService.userCanEditMailing(member, inWorkspace)
    ).resolves.toBe(false);
  });

  it('answers no when the folder check refuses', async () => {
    folderService.hasAccess.mockRejectedValue(new NotFound());

    await expect(
      mailingService.userCanEditMailing(member, inFolder)
    ).resolves.toBe(false);
  });

  it('answers yes to a super admin without asking', async () => {
    await expect(
      mailingService.userCanEditMailing(
        { role: 'super_admin', isAdmin: true },
        inWorkspace
      )
    ).resolves.toBe(true);
    expect(workspaceService.hasAccess).not.toHaveBeenCalled();
  });

  it('lets an unexpected error through', async () => {
    workspaceService.hasAccess.mockRejectedValue(new Error('db down'));

    await expect(
      mailingService.userCanEditMailing(member, inWorkspace)
    ).rejects.toThrow('db down');
  });
});
