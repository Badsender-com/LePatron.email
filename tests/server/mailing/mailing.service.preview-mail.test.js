'use strict';

// GET /mailings/:mailingId/preview used `findById` alone: any signed-in user
// could read any mailing's rendered HTML by id, across companies. It now reads
// like every other mailing: the company first, then the workspace or folder.
//
// The preview is sanitized on the way out, which costs real CPU on a whole
// document, so the result is cached per mailing and per write.

jest.mock('../../../packages/server/common/models.common', () => ({
  Mailings: { findOne: jest.fn() },
  // A company that hides the workspaces a user is not a member of.
  Groups: {
    findById: jest.fn(() =>
      Promise.resolve({ userHasAccessToAllWorkspaces: false })
    ),
  },
  Workspaces: {},
  Folders: {},
  Tags: {},
  Folder: {},
  Profile: {},
  Group: {},
  Users: {},
  Templates: {},
  Galleries: {},
}));
jest.mock('../../../packages/server/workspace/workspace.service.js', () => ({
  hasAccess: jest.fn(),
  getWorkspace: jest.fn(),
  getWorkspaceWithAccessRight: jest.fn(),
  doesUserHaveReadAccess: jest.fn(),
}));
jest.mock('../../../packages/server/folder/folder.service.js', () => ({
  hasAccess: jest.fn(),
  getWorkspaceForFolder: jest.fn(),
}));
jest.mock('../../../packages/server/utils/preview-html-sanitizer.js', () => ({
  sanitizePreviewHtml: jest.fn((html) => `clean:${html}`),
  PREVIEW_HTML_MAX_LENGTH: 5 * 1024 * 1024,
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  Mailings,
  Groups,
} = require('../../../packages/server/common/models.common');
const workspaceService = require('../../../packages/server/workspace/workspace.service.js');
const folderService = require('../../../packages/server/folder/folder.service.js');
const {
  sanitizePreviewHtml,
} = require('../../../packages/server/utils/preview-html-sanitizer.js');
const mailingService = require('../../../packages/server/mailing/mailing.service');

const TENANT_A = '507f1f77bcf86cd799439001';
const TENANT_B = '507f1f77bcf86cd799439002';
const WORKSPACE = '507f1f77bcf86cd799439011';
const USER_ID = '507f1f77bcf86cd799439031';
const OTHER_USER_ID = '507f1f77bcf86cd799439032';
const user = { id: USER_ID, isAdmin: false, group: { id: TENANT_A } };
const FOLDER = '507f1f77bcf86cd799439021';
// A workspace of the caller's company that the caller is not a member of.
const workspace = {
  _id: WORKSPACE,
  name: 'Other team',
  group: TENANT_A,
  _users: [OTHER_USER_ID],
};

let sequence = 0;
function mockPreview(overrides = {}) {
  sequence += 1;
  const doc = {
    // A distinct mailing per test, so the cache of one does not answer another.
    _id: `507f1f77bcf86cd7994390${String(sequence).padStart(2, '0')}`,
    _workspace: WORKSPACE,
    previewHtml: '<p>preview</p>',
    updatedAt: new Date('2026-09-01T10:00:00Z'),
    ...overrides,
  };
  Mailings.findOne.mockReturnValue({ lean: () => Promise.resolve(doc) });
  return doc;
}

beforeEach(() => {
  jest.clearAllMocks();
  // The real read check: the rule under test is its own, not a stub's.
  workspaceService.doesUserHaveReadAccess.mockImplementation(
    jest.requireActual(
      '../../../packages/server/workspace/workspace.service.js'
    ).doesUserHaveReadAccess
  );
  workspaceService.getWorkspace.mockResolvedValue(workspace);
  folderService.getWorkspaceForFolder.mockResolvedValue(workspace);
});

describe('mailingService.previewMail', () => {
  it('scopes the lookup to the caller company', async () => {
    const doc = mockPreview();

    await mailingService.previewMail(doc._id, user);

    expect(Mailings.findOne.mock.calls[0][0]).toMatchObject({
      _id: doc._id,
      _company: TENANT_A,
    });
  });

  // The preview helps a user pick a mailing to copy: like the copy, it is a READ
  // of the source, so workspace membership is not required.
  it('serves the preview of a workspace the user is not a member of', async () => {
    const doc = mockPreview();

    await expect(mailingService.previewMail(doc._id, user)).resolves.toBe(
      'clean:<p>preview</p>'
    );
    expect(workspaceService.getWorkspace).toHaveBeenCalledWith(WORKSPACE);
    expect(workspaceService.doesUserHaveReadAccess).toHaveBeenCalledWith(
      user,
      workspace
    );
    expect(workspaceService.hasAccess).not.toHaveBeenCalled();
  });

  it('serves the preview of a mailing in a folder of such a workspace', async () => {
    const doc = mockPreview({ _workspace: undefined, _parentFolder: FOLDER });

    await expect(mailingService.previewMail(doc._id, user)).resolves.toBe(
      'clean:<p>preview</p>'
    );
    expect(folderService.getWorkspaceForFolder).toHaveBeenCalledWith(FOLDER);
    expect(folderService.hasAccess).not.toHaveBeenCalled();
  });

  // A preview URL shared with a colleague opens for them too. The company's
  // "access to all workspaces" setting hides workspaces from the listing; it is
  // not read here, like for the copy.
  it('does not depend on the company access-to-all-workspaces setting', async () => {
    const doc = mockPreview();

    await expect(mailingService.previewMail(doc._id, user)).resolves.toBe(
      'clean:<p>preview</p>'
    );
    expect(Groups.findById).not.toHaveBeenCalled();
    expect(workspaceService.getWorkspaceWithAccessRight).not.toHaveBeenCalled();
  });

  it('serves a mailing in neither a workspace nor a folder on the company scope alone', async () => {
    const doc = mockPreview({ _workspace: undefined });

    await expect(mailingService.previewMail(doc._id, user)).resolves.toBe(
      'clean:<p>preview</p>'
    );
    expect(workspaceService.doesUserHaveReadAccess).not.toHaveBeenCalled();
  });

  it('refuses a workspace outside the caller company', async () => {
    const doc = mockPreview();
    workspaceService.getWorkspace.mockResolvedValue({
      ...workspace,
      group: TENANT_B,
    });

    await expect(
      mailingService.previewMail(doc._id, user)
    ).rejects.toMatchObject({ status: 404 });
    expect(sanitizePreviewHtml).not.toHaveBeenCalled();
  });

  // Checked after the access: a refused caller must not learn whether a
  // preview exists.
  it('refuses before telling whether the preview exists', async () => {
    const doc = mockPreview({ previewHtml: '' });
    workspaceService.getWorkspace.mockResolvedValue({
      ...workspace,
      group: TENANT_B,
    });

    const error = await mailingService
      .previewMail(doc._id, user)
      .catch((e) => e);

    expect(error.message).toMatch(/^WORKSPACE_NOT_FOUND/);
  });

  it('lets a super admin read any preview', async () => {
    const doc = mockPreview();
    const admin = { role: 'super_admin', isAdmin: true };

    await expect(mailingService.previewMail(doc._id, admin)).resolves.toBe(
      'clean:<p>preview</p>'
    );
    expect(workspaceService.doesUserHaveReadAccess).not.toHaveBeenCalled();
  });

  // Its own code: the modal tells "not generated yet" from "not found".
  it('answers 404 MAILING_PREVIEW_NOT_GENERATED when the mailing has no preview yet', async () => {
    const doc = mockPreview({ previewHtml: '' });

    await expect(
      mailingService.previewMail(doc._id, user)
    ).rejects.toMatchObject({
      status: 404,
      message: 'MAILING_PREVIEW_NOT_GENERATED',
    });
  });

  it('answers 404 for a mailing of another company', async () => {
    Mailings.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    await expect(
      mailingService.previewMail('507f1f77bcf86cd799439099', user)
    ).rejects.toMatchObject({ status: 404 });
  });

  it('serves the sanitized preview', async () => {
    const doc = mockPreview();

    await expect(mailingService.previewMail(doc._id, user)).resolves.toBe(
      'clean:<p>preview</p>'
    );
  });

  it('sanitizes a given version of the preview once', async () => {
    const doc = mockPreview();

    await mailingService.previewMail(doc._id, user);
    await mailingService.previewMail(doc._id, user);

    expect(sanitizePreviewHtml).toHaveBeenCalledTimes(1);
  });

  it('sanitizes again once the mailing was written', async () => {
    const doc = mockPreview();
    await mailingService.previewMail(doc._id, user);

    mockPreview({
      _id: doc._id,
      previewHtml: '<p>edited</p>',
      updatedAt: new Date('2026-09-02T10:00:00Z'),
    });

    await expect(mailingService.previewMail(doc._id, user)).resolves.toBe(
      'clean:<p>edited</p>'
    );
    expect(sanitizePreviewHtml).toHaveBeenCalledTimes(2);
  });

  // Bounded by size, not by count: twenty previews at the 5MB limit would be
  // hundreds of MB held per worker.
  it('does not hold on to a very large preview', async () => {
    const doc = mockPreview({ previewHtml: 'x'.repeat(1024 * 1024) });

    await mailingService.previewMail(doc._id, user);
    await mailingService.previewMail(doc._id, user);

    expect(sanitizePreviewHtml).toHaveBeenCalledTimes(2);
  });

  it('evicts the oldest previews once the budget is spent', async () => {
    const first = mockPreview({ previewHtml: 'a'.repeat(700 * 1024) });
    await mailingService.previewMail(first._id, user);

    // Twelve more of the same size exceed the 8M-character budget.
    for (let i = 0; i < 12; i += 1) {
      const next = mockPreview({ previewHtml: 'b'.repeat(700 * 1024) });
      await mailingService.previewMail(next._id, user);
    }
    sanitizePreviewHtml.mockClear();

    mockPreview({ _id: first._id, previewHtml: 'a'.repeat(700 * 1024) });
    await mailingService.previewMail(first._id, user);

    expect(sanitizePreviewHtml).toHaveBeenCalledTimes(1);
  });
});
