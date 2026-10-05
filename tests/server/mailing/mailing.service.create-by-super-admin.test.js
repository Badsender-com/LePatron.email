'use strict';

// Who signs a new mailing. The bootstrap account has no document and no
// company, so its mailings carry neither. A persisted super admin (ADR 0002)
// is an admin with a document: the mailing is theirs, in the company of the
// workspace it lands in, never in their own platform group.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: { create: jest.fn() },
  Workspaces: { findById: jest.fn(), exists: jest.fn() },
  Folders: { findById: jest.fn(), exists: jest.fn() },
  Tags: {},
  Users: {},
  Templates: {},
  Galleries: {},
  Groups: {},
}));
jest.mock('../../../packages/server/template/template.service.js', () => ({
  findOne: jest.fn(),
  doesUserHaveAccess: jest.fn(),
}));
jest.mock('../../../packages/server/workspace/workspace.service.js', () => ({
  hasAccess: jest.fn(),
}));
jest.mock('../../../packages/server/folder/folder.service.js', () => ({
  hasAccess: jest.fn(),
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  Mailings,
  Workspaces,
} = require('../../../packages/server/common/models.common.js');
const templateService = require('../../../packages/server/template/template.service.js');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const {
  CLIENT_GROUP,
  ALICE,
  FRANK,
  USERS,
  actorFrom,
  bootstrap,
} = require('../../helpers/super-admin-fixtures.js');

const WORKSPACE = '507f1f77bcf86cd799439c01';
const TEMPLATE = '507f1f77bcf86cd799439d01';

const actor = (id) => actorFrom(USERS.find((u) => u._id === id));

beforeEach(() => {
  jest.clearAllMocks();
  templateService.findOne.mockResolvedValue({
    _id: TEMPLATE,
    name: 'Newsletter',
    group: CLIENT_GROUP,
  });
  Workspaces.findById.mockReturnValue({
    select: () => ({ lean: async () => ({ _company: CLIENT_GROUP }) }),
  });
  Workspaces.exists.mockResolvedValue(true);
  Mailings.create.mockImplementation(async (mailing) => ({
    ...mailing,
    data: {},
    toJSON: () => mailing,
  }));
});

async function createIn(user) {
  await mailingService.createInsideWorkspaceOrFolder({
    templateId: TEMPLATE,
    workspaceId: WORKSPACE,
    mailingName: 'Spring campaign',
    user,
  });
  return Mailings.create.mock.calls[0][0];
}

describe('a new mailing in a client workspace', () => {
  it('belongs to a regular user and their own group', async () => {
    const mailing = await createIn(actor(FRANK));

    expect(mailing.userId).toBe(FRANK);
    expect(mailing.userName).toBe('Frank');
    expect(String(mailing.group)).toBe(CLIENT_GROUP);
  });

  it("belongs to a persisted super admin and the workspace's group", async () => {
    const mailing = await createIn(actor(ALICE));

    expect(mailing.userId).toBe(ALICE);
    expect(mailing.userName).toBe('Alice');
    expect(String(mailing.group)).toBe(CLIENT_GROUP);
  });

  it('has no owner and no group for the bootstrap account', async () => {
    const mailing = await createIn({ ...bootstrap, lang: 'en' });

    expect(mailing.userId).toBeUndefined();
    expect(mailing.group).toBeUndefined();
  });
});
