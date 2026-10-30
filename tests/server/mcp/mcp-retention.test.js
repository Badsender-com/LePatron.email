'use strict';

// A group's log retention reaches the MCP call logs and feedbacks already
// kept, as it does the skill invocations: lowering it from 30 to 7 days must
// not keep last week's calls for 30.

const { Types } = require('mongoose');

jest.mock('../../../packages/server/common/models.common.js', () => ({
  McpCallLogs: { find: jest.fn(), bulkWrite: jest.fn() },
  McpFeedbacks: { find: jest.fn(), bulkWrite: jest.fn() },
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
}));

const {
  restampMcpRetention,
} = require('../../../packages/server/mcp/mcp-retention.js');
const {
  McpCallLogs,
  McpFeedbacks,
} = require('../../../packages/server/common/models.common.js');

const GROUP_ID = new Types.ObjectId();

function holds(model, docs) {
  model.find.mockReturnValue({ lean: () => Promise.resolve(docs) });
  model.bulkWrite.mockResolvedValue({});
}

beforeEach(() => {
  jest.clearAllMocks();
  holds(McpCallLogs, []);
  holds(McpFeedbacks, []);
});

describe('restampMcpRetention', () => {
  it('recomputes each deadline of a call log from when it was written', async () => {
    const log = new Types.ObjectId();
    holds(McpCallLogs, [
      { _id: log, createdAt: new Date('2026-10-01T00:00:00Z') },
    ]);

    const out = await restampMcpRetention({
      groupId: GROUP_ID,
      retentionDays: 7,
    });

    expect(out).toEqual({ callLogs: 1, feedbacks: 0 });
    const [op] = McpCallLogs.bulkWrite.mock.calls[0][0];
    expect(op.updateOne.filter._id).toBe(log);
    expect(op.updateOne.update.$set.expiresAt.toISOString()).toBe(
      '2026-10-08T00:00:00.000Z'
    );
  });

  it('recomputes the feedbacks too', async () => {
    holds(McpFeedbacks, [
      {
        _id: new Types.ObjectId(),
        createdAt: new Date('2026-10-01T00:00:00Z'),
      },
    ]);

    await restampMcpRetention({ groupId: GROUP_ID, retentionDays: 90 });

    const [op] = McpFeedbacks.bulkWrite.mock.calls[0][0];
    expect(op.updateOne.update.$set.expiresAt.toISOString()).toBe(
      '2026-12-30T00:00:00.000Z'
    );
  });

  it('reads the group’s records only', async () => {
    await restampMcpRetention({ groupId: GROUP_ID, retentionDays: 30 });

    expect(String(McpCallLogs.find.mock.calls[0][0]._company)).toBe(
      String(GROUP_ID)
    );
    expect(String(McpFeedbacks.find.mock.calls[0][0]._company)).toBe(
      String(GROUP_ID)
    );
  });

  it('writes in batches, and nothing when there is nothing kept', async () => {
    holds(
      McpCallLogs,
      Array.from({ length: 1200 }, () => ({
        _id: new Types.ObjectId(),
        createdAt: new Date('2026-10-01T00:00:00Z'),
      }))
    );

    await restampMcpRetention({ groupId: GROUP_ID, retentionDays: 30 });

    expect(McpCallLogs.bulkWrite).toHaveBeenCalledTimes(3);
    expect(McpFeedbacks.bulkWrite).not.toHaveBeenCalled();
  });
});
