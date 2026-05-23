'use strict';

const { Types } = require('mongoose');

jest.mock('../../../../packages/server/common/models.common', () => ({
  Groups: { find: jest.fn() },
  AISkillInvocations: { deleteMany: jest.fn() },
}));

const {
  purgeInvocations,
  registerJob,
  JOB_NAME,
} = require('../../../../packages/server/ai-skill/jobs/purge-skill-invocations.job');
const {
  Groups,
  AISkillInvocations,
} = require('../../../../packages/server/common/models.common');

beforeEach(() => jest.clearAllMocks());

describe('purge-skill-invocations job', () => {
  it('deletes invocations older than each Group retention window', async () => {
    const g1 = new Types.ObjectId();
    const g2 = new Types.ObjectId();
    Groups.find.mockReturnValue({
      lean: () =>
        Promise.resolve([
          { _id: g1, logRetentionDays: 7 },
          { _id: g2, logRetentionDays: 90 },
        ]),
    });
    AISkillInvocations.deleteMany.mockResolvedValue({ deletedCount: 3 });

    const now = new Date('2026-05-22T00:00:00Z');
    const out = await purgeInvocations({ now });

    expect(out.groupsProcessed).toBe(2);
    expect(out.deleted).toBe(6);
    expect(AISkillInvocations.deleteMany).toHaveBeenCalledTimes(2);

    const firstCall = AISkillInvocations.deleteMany.mock.calls[0][0];
    expect(firstCall._company).toBe(g1);
    expect(firstCall.startedAt.$lt).toEqual(new Date('2026-05-15T00:00:00Z'));
    const secondCall = AISkillInvocations.deleteMany.mock.calls[1][0];
    expect(secondCall.startedAt.$lt).toEqual(new Date('2026-02-21T00:00:00Z'));
  });

  it('uses the default retention when Group does not set logRetentionDays', async () => {
    Groups.find.mockReturnValue({
      lean: () => Promise.resolve([{ _id: new Types.ObjectId() }]),
    });
    AISkillInvocations.deleteMany.mockResolvedValue({ deletedCount: 0 });
    await purgeInvocations({ now: new Date('2026-05-22') });
    const cutoff = AISkillInvocations.deleteMany.mock.calls[0][0].startedAt.$lt;
    // 30 days back from May 22 → April 22.
    expect(cutoff.toISOString().slice(0, 10)).toBe('2026-04-22');
  });

  it('registerJob defines the job under JOB_NAME', () => {
    const scheduler = { define: jest.fn() };
    const info = registerJob(scheduler);
    expect(scheduler.define).toHaveBeenCalledWith(
      JOB_NAME,
      expect.any(Function)
    );
    expect(info.name).toBe(JOB_NAME);
    expect(info.schedule).toMatch(/\d/);
  });
});
