'use strict';

const { Types } = require('mongoose');

jest.mock('../../../../packages/server/common/models.common.js', () => ({
  AISkillInvocations: { create: jest.fn() },
  Groups: { findById: jest.fn() },
}));

const {
  computeExpiresAt,
  logInvocation,
} = require('../../../../packages/server/ai-skill/services/invocation-logger.service');
const {
  AISkillInvocations,
  Groups,
} = require('../../../../packages/server/common/models.common.js');
const {
  DefaultLogRetentionDays,
} = require('../../../../packages/server/ai-skill/constant/skill-constants.js');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GROUP_ID = new Types.ObjectId();
const STARTED_AT = new Date('2026-08-20T12:00:00Z');

function baseParams(overrides = {}) {
  return {
    skill: { _id: new Types.ObjectId(), skillId: 'generic.text' },
    version: { versionMajor: 1, versionMinor: 0 },
    groupId: GROUP_ID,
    startedAt: STARTED_AT,
    status: 'SUCCESS',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  AISkillInvocations.create.mockResolvedValue({ _id: new Types.ObjectId() });
});

describe('computeExpiresAt', () => {
  it('adds the retention window to startedAt', () => {
    expect(computeExpiresAt(STARTED_AT, 7).toISOString()).toBe(
      '2026-08-27T12:00:00.000Z'
    );
  });

  it('falls back to the default retention when none is given', () => {
    expect(computeExpiresAt(STARTED_AT, undefined).getTime()).toBe(
      STARTED_AT.getTime() + DefaultLogRetentionDays * MS_PER_DAY
    );
  });
});

describe('logInvocation retention stamping', () => {
  it('stamps expiresAt from the retention the caller resolved', async () => {
    await logInvocation(baseParams({ retentionDays: 7 }));
    const doc = AISkillInvocations.create.mock.calls[0][0];
    expect(doc.expiresAt.toISOString()).toBe('2026-08-27T12:00:00.000Z');
    // The caller already had the Group — no second read.
    expect(Groups.findById).not.toHaveBeenCalled();
  });

  /**
   * The INPUT_VALIDATION path logs before the Group document is loaded. Reading
   * the retention there matters: defaulting to 30 days would keep a log
   * carrying the caller's input well past what a 7-day Group asked for.
   */
  it('reads the Group retention when the caller could not provide it', async () => {
    Groups.findById.mockReturnValue({
      lean: () => Promise.resolve({ logRetentionDays: 7 }),
    });
    await logInvocation(baseParams());
    const doc = AISkillInvocations.create.mock.calls[0][0];
    expect(doc.expiresAt.toISOString()).toBe('2026-08-27T12:00:00.000Z');
    expect(Groups.findById).toHaveBeenCalledWith(GROUP_ID, {
      logRetentionDays: 1,
    });
  });

  it('still stamps a deadline when the Group read fails', async () => {
    Groups.findById.mockImplementation(() => {
      throw new Error('connection lost');
    });
    await logInvocation(baseParams());
    const doc = AISkillInvocations.create.mock.calls[0][0];
    expect(doc.expiresAt.getTime()).toBe(
      STARTED_AT.getTime() + DefaultLogRetentionDays * MS_PER_DAY
    );
  });

  it('writes nothing at all when logging is skipped', async () => {
    expect(await logInvocation(baseParams({ skipLogging: true }))).toBeNull();
    expect(AISkillInvocations.create).not.toHaveBeenCalled();
  });
});
