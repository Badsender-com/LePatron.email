'use strict';

const {
  GUARD_CAN_ACCESS_GROUP,
} = require('../../../packages/server/group/group.guard');

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

// The request users as passport hands them over, on the group a request names
// in its path, its body or its query.
describe('the group guards, for each kind of user', () => {
  const guards = require('../../../packages/server/group/group.guard');
  const {
    ALICE,
    DAVE,
    FRANK,
    CLIENT_GROUP,
    USERS,
    actorFrom,
    bootstrap,
  } = require('../../helpers/super-admin-fixtures.js');
  const actor = (id) => actorFrom(USERS.find((u) => u._id === id));

  const run = (guard, req) =>
    new Promise((resolve) => guard(req, {}, (err) => resolve(err)));

  describe.each([
    ['GUARD_CAN_ACCESS_GROUP', 'params'],
    ['GUARD_CAN_ACCESS_GROUP_FROM_BODY', 'body'],
    ['GUARD_CAN_ACCESS_GROUP_FROM_QUERY', 'query'],
  ])('%s', (name, source) => {
    it.each([
      ['a super admin', actor(ALICE)],
      ['the bootstrap account', bootstrap],
      ['a member of the group', actor(FRANK)],
    ])('lets %s through', async (_label, user) => {
      const err = await run(guards[name], {
        user,
        [source]: { groupId: CLIENT_GROUP },
      });
      expect(err).toBeUndefined();
    });

    it('refuses a member of another group', async () => {
      const err = await run(guards[name], {
        user: actor(DAVE),
        [source]: { groupId: CLIENT_GROUP },
      });
      expect(err.status).toBe(401);
    });

    it('refuses a member when the request names no group', async () => {
      const err = await run(guards[name], { user: actor(FRANK) });
      expect(err.status).toBe(401);
    });
  });
});
