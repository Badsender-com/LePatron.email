'use strict';

// Deleting a company deletes what its users wrote from their connected
// applications (ADR 0012, ADR 0021): its feedbacks and its retex, open ones
// included, which have no expiry of their own.

const { Types } = require('mongoose');

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Groups: {
    findById: jest.fn(() => ({
      select: () => ({ lean: () => Promise.resolve({ _id: 'g' }) }),
    })),
    deleteOne: jest.fn().mockResolvedValue({}),
  },
  Users: { deleteMany: jest.fn().mockResolvedValue({}) },
  Mailings: { deleteMany: jest.fn().mockResolvedValue({}) },
  Workspaces: {},
  Profiles: { deleteMany: jest.fn().mockResolvedValue({}) },
  Templates: { deleteMany: jest.fn().mockResolvedValue({}) },
  EmailsGroups: { deleteMany: jest.fn().mockResolvedValue({}) },
  AISkillInvocations: { deleteMany: jest.fn().mockResolvedValue({}) },
  AIPlaygroundScenarios: { updateMany: jest.fn().mockResolvedValue({}) },
  McpFeedbacks: { deleteMany: jest.fn().mockResolvedValue({}) },
  McpRetexes: { deleteMany: jest.fn().mockResolvedValue({}) },
}));
jest.mock('../../../packages/server/mcp/mcp-connections.js', () => ({
  forgetConnections: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../packages/server/mcp/mcp-clients.js', () => ({
  forgetCompanyClients: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../packages/server/workspace/workspace.service.js', () => ({
  findWorkspaces: jest.fn().mockResolvedValue([]),
}));

const groupService = require('../../../packages/server/group/group.service.js');
const {
  McpFeedbacks,
  McpRetexes,
} = require('../../../packages/server/common/models.common.js');

describe('deleting a company', () => {
  it('deletes its feedbacks and its retex, open or closed', async () => {
    const groupId = String(new Types.ObjectId());
    const next = jest.fn();

    await groupService.deleteGroup(groupId, {}, next);

    expect(next).not.toHaveBeenCalled();
    [McpFeedbacks, McpRetexes].forEach((model) => {
      expect(model.deleteMany).toHaveBeenCalledTimes(1);
      expect(String(model.deleteMany.mock.calls[0][0]._company)).toBe(groupId);
    });
  });
});
