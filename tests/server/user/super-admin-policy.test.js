'use strict';

// Details of the guardrails the controller suites do not reach: acting on a
// deactivated super admin, and the trace left by each action.

jest.mock('../../../packages/server/common/models.common.js', () => {
  const { createStore } = require('../../helpers/fake-user-models.js');
  const store = createStore();
  return { Users: store.Users, Groups: store.Groups, __store: store };
});
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  __store: store,
} = require('../../../packages/server/common/models.common.js');
const logger = require('../../../packages/server/utils/logger.js');
const policy = require('../../../packages/server/user/super-admin-policy.js');
const {
  GROUPS,
  USERS,
  ALICE,
  BOB,
  bootstrap,
} = require('../../helpers/super-admin-fixtures.js');

beforeEach(() => jest.clearAllMocks());

it('lets a deactivated super admin be demoted when no active one remains', async () => {
  store.seed({
    groups: GROUPS,
    users: USERS.map((u) =>
      u.role === 'super_admin' ? { ...u, isDeactivated: true } : u
    ),
  });
  const bob = await store.Users.findById(BOB);

  await expect(
    policy.assertCanUpdate(bootstrap, bob, 'company_admin')
  ).resolves.toBeUndefined();
});

it('traces a role change with the transition and ids only', async () => {
  store.seed({ groups: GROUPS, users: USERS });
  const alice = await store.Users.findById(ALICE);

  policy.logAction(bootstrap, 'update', alice, 'company_admin', 'super_admin');

  const [line] = logger.info.mock.calls[0];
  expect(line).toContain('update (super_admin -> company_admin)');
  expect(line).toContain(String(ALICE));
  expect(line).not.toContain('@');
});
