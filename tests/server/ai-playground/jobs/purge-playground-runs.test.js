'use strict';

jest.mock('../../../../packages/server/common/models.common', () => ({
  AIPlaygroundRuns: { deleteMany: jest.fn() },
}));

const {
  purgePlaygroundRuns,
  registerJob,
  JOB_NAME,
} = require('../../../../packages/server/ai-playground/jobs/purge-playground-runs.job');
const {
  AIPlaygroundRuns,
} = require('../../../../packages/server/common/models.common');

beforeEach(() => jest.clearAllMocks());

describe('purge-playground-runs job', () => {
  it('deletes runs older than retentionDays, excluding isGolden=true', async () => {
    AIPlaygroundRuns.deleteMany.mockResolvedValue({ deletedCount: 4 });
    const now = new Date('2026-12-01T00:00:00Z');
    const out = await purgePlaygroundRuns({ now, retentionDays: 365 });
    expect(out.deleted).toBe(4);
    expect(out.retentionDays).toBe(365);
    const call = AIPlaygroundRuns.deleteMany.mock.calls[0][0];
    expect(call.createdAt.$lt).toEqual(new Date('2025-12-01T00:00:00Z'));
    expect(call.isGolden).toEqual({ $ne: true });
  });

  it('falls back to the default retention window', async () => {
    AIPlaygroundRuns.deleteMany.mockResolvedValue({ deletedCount: 0 });
    const out = await purgePlaygroundRuns({
      now: new Date('2026-12-01T00:00:00Z'),
    });
    expect(out.retentionDays).toBe(365);
  });

  it('registerJob defines the job under JOB_NAME and returns a cron schedule', () => {
    const scheduler = { define: jest.fn() };
    const info = registerJob(scheduler);
    expect(scheduler.define).toHaveBeenCalledWith(
      JOB_NAME,
      expect.any(Function)
    );
    expect(info.schedule).toMatch(/\d/);
  });
});
