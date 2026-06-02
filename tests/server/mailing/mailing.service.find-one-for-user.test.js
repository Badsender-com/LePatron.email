'use strict';

// Regression tests for the cross-tenant IDOR fix on the "Duplicate + Translate"
// path. findOneForUser MUST scope the lookup by the caller's group so a group
// admin of group A cannot load a mailing of group B by id. The old code used
// the unscoped findOne(), which let duplicate-translate read another tenant's
// mailing.

jest.mock('../../../packages/server/common/models.common', () => ({
  Mailings: {
    findOne: jest.fn(),
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
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { Mailings } = require('../../../packages/server/common/models.common');
const mailingService = require('../../../packages/server/mailing/mailing.service');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

const TENANT_A = '507f1f77bcf86cd799439001';
const MAILING_ID = '507f1f77bcf86cd799439055';

describe('mailingService.findOneForUser (cross-tenant IDOR guard)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('non-admin: scopes the query to the caller _company', async () => {
    const doc = { _id: MAILING_ID, _company: TENANT_A };
    Mailings.findOne.mockResolvedValue(doc);

    const result = await mailingService.findOneForUser(MAILING_ID, {
      isAdmin: false,
      group: { id: TENANT_A },
    });

    expect(result).toBe(doc);
    const filter = Mailings.findOne.mock.calls[0][0];
    expect(String(filter._id)).toBe(MAILING_ID);
    expect(filter._company).toBe(TENANT_A);
  });

  it('returns 404 (NotFound) when the mailing is outside the caller group', async () => {
    // Group-scoped query finds nothing -> NotFound, never leaking group B data.
    Mailings.findOne.mockResolvedValue(null);

    await expect(
      mailingService.findOneForUser(MAILING_ID, {
        isAdmin: false,
        group: { id: TENANT_A },
      })
    ).rejects.toMatchObject({ message: ERROR_CODES.MAILING_NOT_FOUND });
  });

  it('admin: query is not scoped by _company', async () => {
    const doc = { _id: MAILING_ID, _company: 'some-other-group' };
    Mailings.findOne.mockResolvedValue(doc);

    await mailingService.findOneForUser(MAILING_ID, { isAdmin: true });

    const filter = Mailings.findOne.mock.calls[0][0];
    expect(filter._company).toBeUndefined();
  });

  it('rejects an invalid mailing id without querying the DB', async () => {
    await expect(
      mailingService.findOneForUser('not-an-id', {
        isAdmin: false,
        group: { id: TENANT_A },
      })
    ).rejects.toMatchObject({ message: ERROR_CODES.MAILING_NOT_FOUND });
    expect(Mailings.findOne).not.toHaveBeenCalled();
  });
});
