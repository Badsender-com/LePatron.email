'use strict';

// A company's log retention, once (group/log-retention.js): what a log is
// stamped with when written, and what the logs already kept take when the
// retention changes. Lowering it from 30 to 7 days must not keep last week's
// logs for 30, as the nightly purge the TTL indexes replaced did not.

const { Types } = require('mongoose');

jest.mock('../../../packages/server/common/models.common.js', () => ({
  AISkillInvocations: { find: jest.fn(), bulkWrite: jest.fn() },
  McpCallLogs: { find: jest.fn(), bulkWrite: jest.fn() },
  McpFeedbacks: { find: jest.fn(), bulkWrite: jest.fn() },
  Groups: { findById: jest.fn() },
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
}));

const {
  computeExpiresAt,
  restamp,
  restampLogs,
  LOGS,
} = require('../../../packages/server/group/log-retention.js');
const models = require('../../../packages/server/common/models.common.js');
const {
  DefaultLogRetentionDays,
} = require('../../../packages/server/ai-skill/constant/skill-constants.js');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GROUP_ID = new Types.ObjectId();
const FROM = new Date('2026-10-01T00:00:00Z');

// What a collection holds for the company, served through a cursor that
// counts how far it was read.
function holds(model, docs) {
  const read = { count: 0 };
  model.find.mockReturnValue({
    lean: () => ({
      cursor: () => ({
        async *[Symbol.asyncIterator]() {
          for (const doc of docs) {
            read.count += 1;
            yield doc;
          }
        },
      }),
    }),
  });
  model.bulkWrite.mockResolvedValue({});
  return read;
}

// The retention stored for the company, read in turn by each reading.
function stores(...retentions) {
  let read = 0;
  models.Groups.findById.mockImplementation(() => ({
    select: () => ({
      lean: async () => {
        const days = retentions[Math.min(read, retentions.length - 1)];
        read += 1;
        return { logRetentionDays: days };
      },
    }),
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  stores(30);
  holds(models.AISkillInvocations, []);
  holds(models.McpCallLogs, []);
  holds(models.McpFeedbacks, []);
});

describe('computeExpiresAt', () => {
  it('adds the retention to when the log was written', () => {
    expect(computeExpiresAt(FROM, 7).toISOString()).toBe(
      '2026-10-08T00:00:00.000Z'
    );
  });

  it('falls back to the default retention when none is given', () => {
    expect(computeExpiresAt(FROM, undefined).getTime()).toBe(
      FROM.getTime() + DefaultLogRetentionDays * MS_PER_DAY
    );
  });
});

describe('restamp', () => {
  it('recomputes each deadline from that log’s own date', async () => {
    const a = new Types.ObjectId();
    const b = new Types.ObjectId();
    holds(models.AISkillInvocations, [
      { _id: a, startedAt: new Date('2026-08-01T00:00:00Z') },
      { _id: b, startedAt: new Date('2026-08-10T00:00:00Z') },
    ]);

    const count = await restamp(
      models.AISkillInvocations,
      'startedAt',
      GROUP_ID,
      7
    );

    expect(count).toBe(2);
    const ops = models.AISkillInvocations.bulkWrite.mock.calls[0][0];
    expect(ops[0].updateOne.filter._id).toBe(a);
    expect(ops[0].updateOne.update.$set.expiresAt.toISOString()).toBe(
      '2026-08-08T00:00:00.000Z'
    );
    expect(ops[1].updateOne.update.$set.expiresAt.toISOString()).toBe(
      '2026-08-17T00:00:00.000Z'
    );
  });

  it('reads the company’s logs only, and their date only', async () => {
    await restamp(models.McpCallLogs, 'createdAt', GROUP_ID, 30);

    const [filter, projection] = models.McpCallLogs.find.mock.calls[0];
    expect(String(filter._company)).toBe(String(GROUP_ID));
    expect(projection).toEqual({ createdAt: 1 });
  });

  // Through a cursor, in batches: a busy company's logs never all in memory,
  // nor one write each.
  it('writes in batches while it reads', async () => {
    const docs = Array.from({ length: 1200 }, () => ({
      _id: new Types.ObjectId(),
      createdAt: FROM,
    }));
    const read = holds(models.McpCallLogs, docs);
    const readWhenWritten = [];
    models.McpCallLogs.bulkWrite.mockImplementation(async () => {
      readWhenWritten.push(read.count);
      return {};
    });

    const count = await restamp(models.McpCallLogs, 'createdAt', GROUP_ID, 30);

    expect(count).toBe(1200);
    expect(
      models.McpCallLogs.bulkWrite.mock.calls.map(([ops]) => ops.length)
    ).toEqual([500, 500, 200]);
    expect(readWhenWritten[0]).toBe(500);
  });

  it('writes nothing when the company has no log', async () => {
    expect(await restamp(models.McpFeedbacks, 'createdAt', GROUP_ID, 30)).toBe(
      0
    );
    expect(models.McpFeedbacks.bulkWrite).not.toHaveBeenCalled();
  });
});

describe('restampLogs', () => {
  it('reaches the skill invocations, the MCP call logs and the feedbacks', async () => {
    holds(models.AISkillInvocations, [{ _id: 1, startedAt: FROM }]);
    holds(models.McpCallLogs, [{ _id: 2, createdAt: FROM }]);
    holds(models.McpFeedbacks, [{ _id: 3, createdAt: FROM }]);

    const counts = await restampLogs(GROUP_ID);

    expect(counts).toEqual({ invocations: 1, callLogs: 1, feedbacks: 1 });
    expect(LOGS.map(({ model }) => model)).toEqual([
      models.AISkillInvocations,
      models.McpCallLogs,
      models.McpFeedbacks,
    ]);
  });
});

// Two changes of a company's retention close together never mix: the logs
// end with the retention stored, whatever the order the changes arrive in,
// in this worker or in another.
describe('restampLogs, changes close together', () => {
  const writes = () => {
    const written = [];
    models.AISkillInvocations.bulkWrite.mockImplementation(async ([op]) => {
      written.push(op.updateOne.update.$set.expiresAt.toISOString());
      return {};
    });
    return written;
  };
  const stamped = (days) => computeExpiresAt(FROM, days).toISOString();

  it('stamps the retention stored, not an older one it is asked for', async () => {
    holds(models.AISkillInvocations, [{ _id: 1, startedAt: FROM }]);
    const written = writes();
    stores(90);

    await restampLogs(GROUP_ID);

    expect(written).toEqual([stamped(90)]);
  });

  it('starts again when the retention changed while it ran', async () => {
    holds(models.AISkillInvocations, [{ _id: 1, startedAt: FROM }]);
    const written = writes();
    // Read when it starts, then changed by another worker before it ends.
    stores(7, 90, 90);

    await restampLogs(GROUP_ID);

    expect(written).toEqual([stamped(7), stamped(90)]);
  });

  it('runs them one after the other, skipping one a later change replaced', async () => {
    holds(models.AISkillInvocations, [{ _id: 1, startedAt: FROM }]);
    let running = 0;
    let most = 0;
    let release;
    const firstHeld = new Promise((resolve) => {
      release = resolve;
    });
    let calls = 0;
    models.AISkillInvocations.bulkWrite.mockImplementation(async () => {
      running += 1;
      most = Math.max(most, running);
      calls += 1;
      if (calls === 1) await firstHeld;
      running -= 1;
      return {};
    });

    const first = restampLogs(GROUP_ID);
    await new Promise(setImmediate);
    const second = restampLogs(GROUP_ID);
    const third = restampLogs(GROUP_ID);
    release();

    await expect(first).resolves.toMatchObject({ invocations: 1 });
    await expect(second).resolves.toBeNull();
    await expect(third).resolves.toMatchObject({ invocations: 1 });
    expect(most).toBe(1);
  });

  it('runs the next one after one that failed', async () => {
    holds(models.AISkillInvocations, [{ _id: 1, startedAt: FROM }]);
    models.AISkillInvocations.bulkWrite.mockRejectedValueOnce(
      new Error('timed out')
    );

    await expect(restampLogs(GROUP_ID)).rejects.toThrow('timed out');
    await expect(restampLogs(GROUP_ID)).resolves.toMatchObject({
      invocations: 1,
    });
  });
});

// Re-stamping reads a company's logs by company: each collection is indexed
// so, with the date the logs count from.
describe('the logs a retention reaches', () => {
  it.each([
    ['ai-skill/models/ai-skill-invocation.schema.js', 'startedAt'],
    ['mcp/mcp-call-log.schema.js', 'createdAt'],
    ['mcp/mcp-feedback.schema.js', 'createdAt'],
  ])('%s is indexed by company and date', (schemaPath, dateField) => {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const schema = require(`../../../packages/server/${schemaPath}`);

    expect(schema.indexes().map(([fields]) => fields)).toContainEqual({
      _company: 1,
      [dateField]: -1,
    });
  });
});
