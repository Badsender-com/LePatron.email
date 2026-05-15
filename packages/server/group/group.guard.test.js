'use strict';

const { GUARD_CAN_ACCESS_GROUP } = require('./group.guard');

const TENANT_A = '507f1f77bcf86cd799439001';
const TENANT_B = '507f1f77bcf86cd799439002';

function runGuard(req) {
  return new Promise((resolve) => {
    GUARD_CAN_ACCESS_GROUP(req, {}, (err) => resolve(err));
  });
}

describe('GUARD_CAN_ACCESS_GROUP', () => {
  it('rejects when there is no authenticated user', async () => {
    const err = await runGuard({ params: { groupId: TENANT_A } });
    expect(err).toBeDefined();
    expect(err.status).toBe(401);
  });

  it('lets a super-admin through regardless of groupId', async () => {
    const err = await runGuard({
      user: { isAdmin: true },
      params: { groupId: TENANT_B },
    });
    expect(err).toBeUndefined();
  });

  it('lets a regular user access their own group', async () => {
    const err = await runGuard({
      user: { isAdmin: false, group: { id: TENANT_A } },
      params: { groupId: TENANT_A },
    });
    expect(err).toBeUndefined();
  });

  it('REJECTS a regular user trying to access another group (H1 fix)', async () => {
    const err = await runGuard({
      user: { isAdmin: false, group: { id: TENANT_A } },
      params: { groupId: TENANT_B },
    });
    expect(err).toBeDefined();
    expect(err.status).toBe(401);
  });
});
