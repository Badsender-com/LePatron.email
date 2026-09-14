'use strict';

const { Types } = require('mongoose');

jest.mock('../../../../packages/server/common/models.common', () => ({
  AISkillInvocations: {
    find: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
    bulkWrite: jest.fn(),
  },
}));

const invocationService = require('../../../../packages/server/ai-skill/services/invocation-log.service');
const {
  AISkillInvocations,
} = require('../../../../packages/server/common/models.common');

function chain(value) {
  return {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('invocation-log.service', () => {
  describe('listInvocations', () => {
    it('filters by skillId, status, group and date range', async () => {
      AISkillInvocations.find.mockReturnValue(chain([]));
      AISkillInvocations.countDocuments.mockResolvedValue(0);
      const groupId = new Types.ObjectId();
      await invocationService.listInvocations({
        skillId: 'redaction.cta',
        status: 'SUCCESS',
        groupId,
        startedFrom: '2026-01-01',
        startedTo: '2026-01-31',
      });
      const query = AISkillInvocations.find.mock.calls[0][0];
      expect(query).toMatchObject({
        skillId: 'redaction.cta',
        status: 'SUCCESS',
        _company: groupId,
      });
      expect(query.startedAt.$gte).toBeInstanceOf(Date);
      expect(query.startedAt.$lte).toBeInstanceOf(Date);
    });

    it('excludes non-productive invocation sources by default', async () => {
      AISkillInvocations.find.mockReturnValue(chain([]));
      AISkillInvocations.countDocuments.mockResolvedValue(0);
      await invocationService.listInvocations({});
      const query = AISkillInvocations.find.mock.calls[0][0];
      expect(query.invocationSource).toEqual({
        $nin: ['admin-test', 'playground'],
        $not: /^poc\./,
      });
    });

    it('includes everything when includeNonProductive is set', async () => {
      AISkillInvocations.find.mockReturnValue(chain([]));
      AISkillInvocations.countDocuments.mockResolvedValue(0);
      // Query-string transport: the controller passes 'true' as a string.
      await invocationService.listInvocations({ includeNonProductive: 'true' });
      const query = AISkillInvocations.find.mock.calls[0][0];
      expect(query.invocationSource).toBeUndefined();
    });

    it('lets an explicit invocationSource filter win over the exclusion', async () => {
      AISkillInvocations.find.mockReturnValue(chain([]));
      AISkillInvocations.countDocuments.mockResolvedValue(0);
      await invocationService.listInvocations({
        invocationSource: 'playground',
      });
      const query = AISkillInvocations.find.mock.calls[0][0];
      expect(query.invocationSource).toBe('playground');
    });

    it('a skill Logs query (skillId + includeNonProductive) keeps playground runs', async () => {
      // The skill's own Logs tab passes includeNonProductive:true → no
      // source exclusion, so its playground runs show without any toggle.
      AISkillInvocations.find.mockReturnValue(chain([]));
      AISkillInvocations.countDocuments.mockResolvedValue(0);
      await invocationService.listInvocations({
        skillId: 'redaction.cta.promo',
        includeNonProductive: true,
      });
      const query = AISkillInvocations.find.mock.calls[0][0];
      expect(query.skillId).toBe('redaction.cta.promo');
      expect(query.invocationSource).toBeUndefined();
    });
  });

  describe('pagination and sort', () => {
    function listWith(params) {
      const c = chain([]);
      AISkillInvocations.find.mockReturnValue(c);
      AISkillInvocations.countDocuments.mockResolvedValue(0);
      return invocationService.listInvocations(params).then(() => c);
    }

    it('defaults to the first page of 50, newest first', async () => {
      const c = await listWith({});
      expect(c.sort).toHaveBeenCalledWith({ startedAt: -1 });
      expect(c.skip).toHaveBeenCalledWith(0);
      expect(c.limit).toHaveBeenCalledWith(50);
    });

    it('translates page/pageSize into skip/limit', async () => {
      const c = await listWith({ page: 3, pageSize: 25 });
      expect(c.skip).toHaveBeenCalledWith(50);
      expect(c.limit).toHaveBeenCalledWith(25);
    });

    it('accepts a whitelisted sort field, in both directions', async () => {
      let c = await listWith({ sortBy: 'latencyMs', sortDesc: true });
      expect(c.sort).toHaveBeenCalledWith({ latencyMs: -1 });
      c = await listWith({ sortBy: 'skillId', sortDesc: false });
      expect(c.sort).toHaveBeenCalledWith({ skillId: 1 });
    });

    it('reads sortDesc sent as a query string', async () => {
      const c = await listWith({ sortBy: 'status', sortDesc: 'true' });
      expect(c.sort).toHaveBeenCalledWith({ status: -1 });
    });

    it('falls back to the default sort for a field outside the whitelist', async () => {
      // The value reaches a Mongo sort spec, so an arbitrary client string
      // must never be honoured.
      for (const sortBy of [
        'error.message',
        'tokenUsage.totalTokens',
        '$where',
      ]) {
        const c = await listWith({ sortBy, sortDesc: true });
        expect(c.sort).toHaveBeenCalledWith({ startedAt: -1 });
      }
    });

    it('exposes the whitelist so the UI can mirror it', () => {
      expect(invocationService.SortableFields).toContain('startedAt');
      expect(invocationService.SortableFields).not.toContain('tokens');
      expect(invocationService.SortableFields).not.toContain('group');
    });
  });

  describe('getInvocation', () => {
    it('throws 404 when not found', async () => {
      AISkillInvocations.findById.mockReturnValue({
        lean: () => Promise.resolve(null),
      });
      await expect(
        invocationService.getInvocation(new Types.ObjectId())
      ).rejects.toMatchObject({ status: 404 });
    });
  });
});

describe('restampRetention', () => {
  const GROUP_ID = new Types.ObjectId();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  function mockDocs(docs) {
    AISkillInvocations.find.mockReturnValue({
      lean: () => Promise.resolve(docs),
    });
    AISkillInvocations.bulkWrite.mockResolvedValue({});
  }

  /**
   * expiresAt is stamped at write time, so without this a Group lowering its
   * retention from 30 to 7 days would keep its existing logs for 30 — weaker
   * than the nightly purge the TTL index replaced, which recomputed the cutoff
   * on every run.
   */
  it('recomputes each deadline from that document own startedAt', async () => {
    const a = new Types.ObjectId();
    const b = new Types.ObjectId();
    mockDocs([
      { _id: a, startedAt: new Date('2026-08-01T00:00:00Z') },
      { _id: b, startedAt: new Date('2026-08-10T00:00:00Z') },
    ]);

    const out = await invocationService.restampRetention({
      groupId: GROUP_ID,
      retentionDays: 7,
    });

    expect(out.restamped).toBe(2);
    const ops = AISkillInvocations.bulkWrite.mock.calls[0][0];
    expect(ops[0].updateOne.filter._id).toBe(a);
    expect(ops[0].updateOne.update.$set.expiresAt.toISOString()).toBe(
      '2026-08-08T00:00:00.000Z'
    );
    expect(ops[1].updateOne.update.$set.expiresAt.toISOString()).toBe(
      '2026-08-17T00:00:00.000Z'
    );
  });

  it('scopes the read to the Group', async () => {
    mockDocs([]);
    await invocationService.restampRetention({
      groupId: GROUP_ID,
      retentionDays: 30,
    });
    const query = AISkillInvocations.find.mock.calls[0][0];
    expect(String(query._company)).toBe(String(GROUP_ID));
  });

  it('writes nothing when the Group has no invocation', async () => {
    mockDocs([]);
    const out = await invocationService.restampRetention({
      groupId: GROUP_ID,
      retentionDays: 30,
    });
    expect(out.restamped).toBe(0);
    expect(AISkillInvocations.bulkWrite).not.toHaveBeenCalled();
  });

  // Batched rather than one write per document, and without an
  // aggregation-pipeline update, which would need MongoDB 4.2 while the project
  // documents 3.4 as its minimum.
  it('batches instead of issuing one write per document', async () => {
    const docs = Array.from({ length: 1200 }, () => ({
      _id: new Types.ObjectId(),
      startedAt: new Date('2026-08-01T00:00:00Z'),
    }));
    mockDocs(docs);

    const out = await invocationService.restampRetention({
      groupId: GROUP_ID,
      retentionDays: 30,
    });

    expect(out.restamped).toBe(1200);
    expect(AISkillInvocations.bulkWrite).toHaveBeenCalledTimes(3);
    expect(AISkillInvocations.bulkWrite.mock.calls[0][0]).toHaveLength(500);
    expect(AISkillInvocations.bulkWrite.mock.calls[2][0]).toHaveLength(200);
  });

  it('falls back to the default retention when none is given', async () => {
    mockDocs([
      {
        _id: new Types.ObjectId(),
        startedAt: new Date('2026-08-01T00:00:00Z'),
      },
    ]);
    await invocationService.restampRetention({ groupId: GROUP_ID });
    const at =
      AISkillInvocations.bulkWrite.mock.calls[0][0][0].updateOne.update.$set
        .expiresAt;
    expect(at.getTime()).toBe(
      new Date('2026-08-01T00:00:00Z').getTime() + 30 * MS_PER_DAY
    );
  });
});
