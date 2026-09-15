'use strict';

// The `emailMetadata.enabled` flag is presented as a kill-switch: a company that
// has not opted in must not end up with metadata on its emails, and the preheader
// is written into the template `data` that ends up in the sent email. Without a
// server-side check the flag would only hide fields in the UI, which a request
// bypassing the UI ignores.
//
// Note the default is the OPPOSITE of GUARD_EMAIL_BUILDER: this feature is off
// unless a company opts in, so an absent config means disabled.

jest.mock('../../../packages/server/common/models.common', () => ({
  Groups: {
    findById: jest.fn(),
  },
}));

const { Groups } = require('../../../packages/server/common/models.common');
const {
  GUARD_EMAIL_METADATA,
} = require('../../../packages/server/mailing/email-metadata.guard');
const ERROR_CODES = require('../../../packages/server/constant/error-codes');

const GROUP_ID = '507f1f77bcf86cd799439001';

function mockGroup(group) {
  Groups.findById.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(group),
    }),
  });
}

function runGuard(req) {
  return new Promise((resolve) => {
    GUARD_EMAIL_METADATA(req, {}, (err) => resolve(err));
  });
}

const user = { isAdmin: false, group: { id: GROUP_ID } };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GUARD_EMAIL_METADATA', () => {
  it('rejects when there is no authenticated user', async () => {
    const err = await runGuard({});
    expect(err.status).toBe(401);
    expect(Groups.findById).not.toHaveBeenCalled();
  });

  it('lets a super-admin through without checking the flag', async () => {
    const err = await runGuard({ user: { isAdmin: true } });
    expect(err).toBeUndefined();
    expect(Groups.findById).not.toHaveBeenCalled();
  });

  it('lets a user of an opted-in company through', async () => {
    mockGroup({ emailMetadata: { enabled: true } });
    expect(await runGuard({ user })).toBeUndefined();
  });

  it('rejects a user of a company that opted out', async () => {
    mockGroup({ emailMetadata: { enabled: false } });
    const err = await runGuard({ user });
    expect(err.status).toBe(403);
    expect(err.message).toBe(ERROR_CODES.EMAIL_METADATA_DISABLED);
  });

  it.each([
    ['no config at all', {}],
    ['an empty config', { emailMetadata: {} }],
    ['a null config', { emailMetadata: null }],
    ['a truthy-but-not-true value', { emailMetadata: { enabled: 'yes' } }],
  ])('rejects a company with %s', async (_label, group) => {
    mockGroup(group);
    const err = await runGuard({ user });
    expect(err.status).toBe(403);
    expect(err.message).toBe(ERROR_CODES.EMAIL_METADATA_DISABLED);
  });

  it('rejects a user with no company', async () => {
    const err = await runGuard({ user: { isAdmin: false } });
    expect(err.status).toBe(400);
    expect(Groups.findById).not.toHaveBeenCalled();
  });

  it('rejects when the company no longer exists', async () => {
    mockGroup(null);
    const err = await runGuard({ user });
    expect(err.status).toBe(404);
  });

  it('reads only the emailMetadata field', async () => {
    const select = jest
      .fn()
      .mockReturnValue({ lean: jest.fn().mockResolvedValue({}) });
    Groups.findById.mockReturnValue({ select });

    await runGuard({ user });

    expect(select).toHaveBeenCalledWith('emailMetadata');
  });
});
