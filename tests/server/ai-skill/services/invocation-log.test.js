'use strict';

const { Types } = require('mongoose');

jest.mock('../../../../packages/server/common/models.common', () => ({
  AISkillInvocations: {
    find: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
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

    it('excludes non-productive featureTypes by default', async () => {
      AISkillInvocations.find.mockReturnValue(chain([]));
      AISkillInvocations.countDocuments.mockResolvedValue(0);
      await invocationService.listInvocations({});
      const query = AISkillInvocations.find.mock.calls[0][0];
      expect(query.featureType).toEqual({
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
      expect(query.featureType).toBeUndefined();
    });

    it('lets an explicit featureType filter win over the exclusion', async () => {
      AISkillInvocations.find.mockReturnValue(chain([]));
      AISkillInvocations.countDocuments.mockResolvedValue(0);
      await invocationService.listInvocations({ featureType: 'playground' });
      const query = AISkillInvocations.find.mock.calls[0][0];
      expect(query.featureType).toBe('playground');
    });

    it('a skill Logs query (skillId + includeNonProductive) keeps playground runs', async () => {
      // The skill's own Logs tab passes includeNonProductive:true → no
      // featureType exclusion, so its playground runs show without any toggle.
      AISkillInvocations.find.mockReturnValue(chain([]));
      AISkillInvocations.countDocuments.mockResolvedValue(0);
      await invocationService.listInvocations({
        skillId: 'redaction.cta.promo',
        includeNonProductive: true,
      });
      const query = AISkillInvocations.find.mock.calls[0][0];
      expect(query.skillId).toBe('redaction.cta.promo');
      expect(query.featureType).toBeUndefined();
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
