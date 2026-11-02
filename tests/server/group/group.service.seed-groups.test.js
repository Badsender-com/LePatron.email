'use strict';

// Seeding gives every group without a workspace a default one, and sets its
// users back to regular users. A super admin keeps the role: only the
// guardrails of ADR 0002 take it away.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Groups: { find: jest.fn() },
  Users: { find: jest.fn(), updateMany: jest.fn() },
  Mailings: { find: jest.fn(), updateMany: jest.fn() },
  Workspaces: { distinct: jest.fn() },
}));
jest.mock('../../../packages/server/workspace/workspace.service.js', () => ({
  createWorkspace: jest.fn(),
}));

const {
  Groups,
  Users,
  Mailings,
  Workspaces,
} = require('../../../packages/server/common/models.common.js');
const workspaceService = require('../../../packages/server/workspace/workspace.service.js');
const groupService = require('../../../packages/server/group/group.service.js');

const GROUP = '507f1f77bcf86cd799439a01';
const USER = '507f1f77bcf86cd799439101';

it('leaves super admins out of the reset to regular user', async () => {
  Workspaces.distinct.mockResolvedValue([]);
  Groups.find.mockResolvedValue([{ id: GROUP }]);
  Users.find.mockResolvedValue([{ _id: USER }]);
  Users.updateMany.mockResolvedValue({ ok: 1 });
  workspaceService.createWorkspace.mockResolvedValue({ _id: 'w1' });
  Mailings.find.mockResolvedValue([]);
  Mailings.updateMany.mockResolvedValue({ ok: 1 });

  await groupService.seedGroups();

  const [filter, update] = Users.updateMany.mock.calls[0];
  expect(filter.role).toEqual({ $ne: 'super_admin' });
  expect(update).toEqual({ role: 'regular_user' });
});
