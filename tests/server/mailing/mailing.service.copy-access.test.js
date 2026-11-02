'use strict';

// Copying is a READ of the source: a user may copy a mailing out of any
// workspace of their company, member or not, into a workspace they can write
// to. The source workspace is resolved by `getOwningWorkspace`, shared with
// the preview, for a mailing at the root of a workspace or in a folder.

jest.mock('../../../packages/server/common/models.common', () => ({
  Mailings: { findOne: jest.fn(), create: jest.fn() },
  Galleries: { findOne: jest.fn() },
  Groups: { findById: jest.fn() },
  Workspaces: {},
  Folders: {},
  Tags: {},
  Folder: {},
  Profile: {},
  Group: {},
  Users: {},
  Templates: {},
}));
jest.mock('../../../packages/server/workspace/workspace.service.js', () => ({
  getWorkspace: jest.fn(),
  doesUserHaveReadAccess: jest.fn(),
  doesUserHaveWriteAccess: jest.fn(),
}));
jest.mock('../../../packages/server/folder/folder.service.js', () => ({
  hasAccess: jest.fn(),
  getFolder: jest.fn(),
  getWorkspaceForFolder: jest.fn(),
}));
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({
  copyImages: jest.fn(),
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  Mailings,
  Galleries,
  Groups,
} = require('../../../packages/server/common/models.common');
const workspaceService = require('../../../packages/server/workspace/workspace.service.js');
const folderService = require('../../../packages/server/folder/folder.service.js');
const mailingService = require('../../../packages/server/mailing/mailing.service');

const TENANT_A = '507f1f77bcf86cd799439001';
const TENANT_B = '507f1f77bcf86cd799439002';
const MAILING = '507f1f77bcf86cd799439041';
const FOLDER = '507f1f77bcf86cd799439021';
const USER_ID = '507f1f77bcf86cd799439031';
const OTHER_USER_ID = '507f1f77bcf86cd799439032';
const user = {
  id: USER_ID,
  _id: USER_ID,
  name: 'Reader',
  group: { id: TENANT_A },
};
// The source: a workspace of the caller's company they are not a member of.
const source = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Other team',
  group: TENANT_A,
  _users: [OTHER_USER_ID],
};
// The destination: a workspace the caller is a member of.
const destination = {
  _id: '507f1f77bcf86cd799439012',
  name: 'My team',
  group: TENANT_A,
  _users: [USER_ID],
};

function mockMailing(location) {
  const doc = { _id: MAILING, name: 'Newsletter', ...location };
  Mailings.findOne.mockResolvedValue({ ...doc, toObject: () => ({ ...doc }) });
}

function copyToMyWorkspace() {
  return mailingService.copyMailing(
    MAILING,
    { workspaceId: destination._id },
    user
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // The real checks: the rule under test is theirs, not a stub's.
  const actual = jest.requireActual(
    '../../../packages/server/workspace/workspace.service.js'
  );
  workspaceService.doesUserHaveReadAccess.mockImplementation(
    actual.doesUserHaveReadAccess
  );
  workspaceService.doesUserHaveWriteAccess.mockImplementation(
    actual.doesUserHaveWriteAccess
  );
  workspaceService.getWorkspace.mockImplementation(async (id) =>
    id === destination._id ? destination : source
  );
  folderService.getWorkspaceForFolder.mockResolvedValue(source);
  Mailings.create.mockResolvedValue({ _id: '507f1f77bcf86cd799439051' });
  Galleries.findOne.mockResolvedValue(null);
});

describe('mailingService.copyMailing, access to the source', () => {
  it('copies out of a workspace the user is not a member of', async () => {
    mockMailing({ _workspace: source._id });

    await copyToMyWorkspace();

    expect(workspaceService.getWorkspace).toHaveBeenCalledWith(source._id);
    expect(workspaceService.doesUserHaveReadAccess).toHaveBeenCalledWith(
      user,
      source
    );
    expect(Mailings.create).toHaveBeenCalledTimes(1);
    // The company's "access to all workspaces" setting is not read.
    expect(Groups.findById).not.toHaveBeenCalled();
  });

  it('copies out of a folder of such a workspace', async () => {
    mockMailing({ _parentFolder: FOLDER });

    await copyToMyWorkspace();

    expect(folderService.getWorkspaceForFolder).toHaveBeenCalledWith(FOLDER);
    expect(workspaceService.doesUserHaveReadAccess).toHaveBeenCalledWith(
      user,
      source
    );
    expect(folderService.hasAccess).not.toHaveBeenCalled();
    expect(Mailings.create).toHaveBeenCalledTimes(1);
  });

  it('refuses a source workspace outside the caller company', async () => {
    mockMailing({ _workspace: source._id });
    workspaceService.getWorkspace.mockImplementation(async (id) =>
      id === destination._id ? destination : { ...source, group: TENANT_B }
    );

    await expect(copyToMyWorkspace()).rejects.toMatchObject({ status: 404 });
    expect(Mailings.create).not.toHaveBeenCalled();
  });

  it('still requires write access to the destination', async () => {
    mockMailing({ _workspace: source._id });

    await expect(
      mailingService.copyMailing(MAILING, { workspaceId: source._id }, user)
    ).rejects.toMatchObject({ status: 403 });
    expect(Mailings.create).not.toHaveBeenCalled();
  });
});
