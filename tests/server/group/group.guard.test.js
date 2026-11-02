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
      user: { role: 'super_admin' },
      params: { groupId: TENANT_B },
    });
    expect(err).toBeUndefined();
  });

  it('lets a regular user access their own group', async () => {
    const err = await runGuard({
      user: { group: { id: TENANT_A } },
      params: { groupId: TENANT_A },
    });
    expect(err).toBeUndefined();
  });

  it('REJECTS a regular user trying to access another group (H1 fix)', async () => {
    const err = await runGuard({
      user: { group: { id: TENANT_A } },
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

// A group is named by its id. An object in a body or a query string
// (`groupId[_id]=…`) is refused before the controller reads it, for every
// user, rather than read as the id it carries.
describe('the group guards, on a group id that is not a string', () => {
  const guards = require('../../../packages/server/group/group.guard');
  const member = { role: 'company_admin', group: { id: TENANT_A } };
  const superAdmin = { role: 'super_admin' };

  const run = (guard, req) =>
    new Promise((resolve) => guard(req, {}, (err) => resolve(err)));

  it.each([
    ['an object carrying the own id', { _id: TENANT_A }],
    ['an object with an id field', { id: TENANT_A }],
    ['a fake ObjectId', { _bsontype: 'ObjectId' }],
    ['an object with its own toString', { toString: 'x' }],
    ['a list', [TENANT_A]],
  ])('refuses %s with a 400', async (_label, groupId) => {
    for (const user of [member, superAdmin]) {
      const fromBody = await run(guards.GUARD_CAN_ACCESS_GROUP_FROM_BODY, {
        user,
        body: { groupId },
      });
      const fromQuery = await run(guards.GUARD_CAN_ACCESS_GROUP_FROM_QUERY, {
        user,
        query: { groupId },
      });
      expect(fromBody.status).toBe(400);
      expect(fromQuery.status).toBe(400);
    }
  });
});
