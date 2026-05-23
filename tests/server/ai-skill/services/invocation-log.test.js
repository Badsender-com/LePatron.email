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
