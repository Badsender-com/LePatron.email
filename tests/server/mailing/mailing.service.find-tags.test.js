'use strict';

// Smoke tests for the admin path of mailingService.findTags.
// Before this branch, findTags relied on addStrictGroupFilter, which produced
// a corrupt query when called by a super-admin (no _company on the user
// record) and silently returned no tags. The code derives the company from the
// workspace or parent folder being viewed. These tests pin that contract so
// future refactors don't reintroduce the regression.
//
// findTags also used to merge a live `Mailings.distinct('tags', { _company })`
// to surface labels of historical mailings with no `Tag` row. That distinct
// scanned every mailing of the company and timed out in production, so it was
// removed: `Tag` is now the single source of truth (orphan labels are
// backfilled by scripts/backfill-tags.js). These tests pin that the distinct is
// gone and findTags returns the Tag collection as-is.

jest.mock('../../../packages/server/common/models.common', () => ({
  Mailings: {
    findTags: jest.fn(),
    distinct: jest.fn(),
  },
  Workspaces: { findById: jest.fn() },
  Folders: { findById: jest.fn() },
  Tags: {},
  Folder: {},
  Profile: {},
  Group: {},
  Users: {},
  Templates: {},
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));

const {
  Mailings,
  Workspaces,
  Folders,
} = require('../../../packages/server/common/models.common');
const mailingService = require('../../../packages/server/mailing/mailing.service');

const TENANT_A = '507f1f77bcf86cd799439001';
const WORKSPACE_ID = '507f1f77bcf86cd799439010';
const FOLDER_ID = '507f1f77bcf86cd799439020';

function mockChain(value, method) {
  // Build {[method]: () => { lean: () => Promise(value) }} for Workspaces/Folders.
  if (method === 'workspace') {
    Workspaces.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(value),
      }),
    });
  } else {
    Folders.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(value),
      }),
    });
  }
}

describe('mailingService.findTags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Mailings.findTags.mockResolvedValue([]);
    Mailings.distinct.mockResolvedValue([]);
  });

  it('non-admin: derives companyId from user.group.id and reads only the Tag collection', async () => {
    Mailings.findTags.mockResolvedValue(['b2b', 'promo']);

    const tags = await mailingService.findTags({
      user: { isAdmin: false, group: { id: TENANT_A } },
    });

    expect(Mailings.findTags).toHaveBeenCalledWith({ _company: TENANT_A });
    // The costly distinct('tags') scan must no longer be used.
    expect(Mailings.distinct).not.toHaveBeenCalled();
    // Returned as-is from the Tag collection (already sorted by label).
    expect(tags).toEqual(['b2b', 'promo']);
  });

  it('admin + workspaceId: derives companyId from the workspace', async () => {
    mockChain({ _company: TENANT_A }, 'workspace');
    Mailings.findTags.mockResolvedValue(['x']);

    const tags = await mailingService.findTags({
      user: { isAdmin: true },
      workspaceId: WORKSPACE_ID,
    });

    expect(Workspaces.findById).toHaveBeenCalledWith(WORKSPACE_ID);
    expect(Mailings.findTags).toHaveBeenCalledWith({ _company: TENANT_A });
    expect(tags).toEqual(['x']);
  });

  it('admin + parentFolderId: derives companyId from the folder', async () => {
    mockChain({ _workspace: { _company: TENANT_A } }, 'folder');

    await mailingService.findTags({
      user: { isAdmin: true },
      parentFolderId: FOLDER_ID,
    });

    expect(Folders.findById).toHaveBeenCalledWith(FOLDER_ID);
    expect(Mailings.findTags).toHaveBeenCalledWith({ _company: TENANT_A });
  });

  it('admin without workspaceId nor parentFolderId: returns [] (no scope inferred)', async () => {
    const tags = await mailingService.findTags({
      user: { isAdmin: true },
    });

    expect(tags).toEqual([]);
    expect(Mailings.findTags).not.toHaveBeenCalled();
    expect(Mailings.distinct).not.toHaveBeenCalled();
  });

  it('returns the Tag collection result without a distinct scan', async () => {
    Mailings.findTags.mockResolvedValue(['B2B', 'Promo', 'Sale']);

    const tags = await mailingService.findTags({
      user: { isAdmin: false, group: { id: TENANT_A } },
    });

    expect(tags).toEqual(['B2B', 'Promo', 'Sale']);
    expect(Mailings.distinct).not.toHaveBeenCalled();
  });
});
