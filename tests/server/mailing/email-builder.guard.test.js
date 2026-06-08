'use strict';

jest.mock('../../../packages/server/common/models.common', () => ({
  Groups: {
    findById: jest.fn(),
  },
}));

const { Groups } = require('../../../packages/server/common/models.common');
const {
  GUARD_EMAIL_BUILDER,
} = require('../../../packages/server/mailing/email-builder.guard');
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
    GUARD_EMAIL_BUILDER(req, {}, (err) => resolve(err));
  });
}

describe('GUARD_EMAIL_BUILDER', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when there is no authenticated user', async () => {
    const err = await runGuard({});
    expect(err).toBeDefined();
    expect(err.status).toBe(401);
    expect(Groups.findById).not.toHaveBeenCalled();
  });

  it('lets a super-admin through without checking the flag', async () => {
    const err = await runGuard({ user: { isAdmin: true } });
    expect(err).toBeUndefined();
    expect(Groups.findById).not.toHaveBeenCalled();
  });

  it('rejects when the user has no group attached', async () => {
    const err = await runGuard({ user: { isAdmin: false } });
    expect(err).toBeDefined();
    expect(err.status).toBe(400);
    expect(err.message).toBe(ERROR_CODES.GROUP_NOT_FOUND);
  });

  it('rejects with 404 when the group does not exist anymore', async () => {
    mockGroup(null);
    const err = await runGuard({
      user: { isAdmin: false, group: { id: GROUP_ID } },
    });
    expect(err).toBeDefined();
    expect(err.status).toBe(404);
  });

  it('lets the user through when enableEmailBuilder is true', async () => {
    mockGroup({ enableEmailBuilder: true });
    const err = await runGuard({
      user: { isAdmin: false, group: { id: GROUP_ID } },
    });
    expect(err).toBeUndefined();
  });

  it('lets the user through when enableEmailBuilder is undefined (legacy group, default true)', async () => {
    mockGroup({});
    const err = await runGuard({
      user: { isAdmin: false, group: { id: GROUP_ID } },
    });
    expect(err).toBeUndefined();
  });

  it('REJECTS with 403 when enableEmailBuilder is explicitly false', async () => {
    mockGroup({ enableEmailBuilder: false });
    const err = await runGuard({
      user: { isAdmin: false, group: { id: GROUP_ID } },
    });
    expect(err).toBeDefined();
    expect(err.status).toBe(403);
    expect(err.message).toBe(ERROR_CODES.EMAIL_BUILDER_DISABLED);
  });

  it('forwards DB errors to next() rather than crashing', async () => {
    Groups.findById.mockImplementation(() => {
      throw new Error('boom');
    });
    const err = await runGuard({
      user: { isAdmin: false, group: { id: GROUP_ID } },
    });
    expect(err).toBeDefined();
    expect(err.message).toBe('boom');
  });
});
