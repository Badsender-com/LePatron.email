'use strict';

// GET /mailings/:mailingId/preview used `findById` alone: any signed-in user
// could read any mailing's rendered HTML by id, across companies. It now reads
// like every other mailing: the company first, then the workspace or folder.
//
// The preview is sanitized on the way out, which costs real CPU on a whole
// document, so the result is cached per mailing and per write.

jest.mock('../../../packages/server/common/models.common', () => ({
  Mailings: { findOne: jest.fn() },
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
}));
jest.mock('../../../packages/server/folder/folder.service.js', () => ({
  hasAccess: jest.fn(),
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

const { Mailings } = require('../../../packages/server/common/models.common');
const workspaceService = require('../../../packages/server/workspace/workspace.service.js');
const {
  sanitizePreviewHtml,
} = require('../../../packages/server/utils/preview-html-sanitizer.js');
const mailingService = require('../../../packages/server/mailing/mailing.service');

const TENANT_A = '507f1f77bcf86cd799439001';
const WORKSPACE = '507f1f77bcf86cd799439011';
const user = { isAdmin: false, group: { id: TENANT_A } };

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
  workspaceService.hasAccess.mockResolvedValue(true);
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

  it('refuses a user without access to the workspace', async () => {
    const doc = mockPreview();
    workspaceService.hasAccess.mockResolvedValue(false);

    await expect(
      mailingService.previewMail(doc._id, user)
    ).rejects.toMatchObject({ status: 403 });
    expect(sanitizePreviewHtml).not.toHaveBeenCalled();
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
