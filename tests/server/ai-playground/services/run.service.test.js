'use strict';

const { Types } = require('mongoose');

jest.mock('../../../../packages/server/common/models.common', () => ({
  AIPlaygroundRuns: {
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    updateMany: jest.fn(),
    deleteOne: jest.fn(),
  },
  AIPlaygroundScenarios: {
    findOne: jest.fn(),
    updateOne: jest.fn(),
  },
}));

const runService = require('../../../../packages/server/ai-playground/services/run.service');
const {
  AIPlaygroundRuns,
  AIPlaygroundScenarios,
} = require('../../../../packages/server/common/models.common');

function mockRunDoc(overrides = {}) {
  return {
    _id: new Types.ObjectId(),
    _scenario: new Types.ObjectId(),
    isGolden: false,
    feedback: null,
    save: jest.fn().mockImplementation(async function () {
      return this;
    }),
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('run.service', () => {
  describe('listRunsForScenario', () => {
    it('throws 404 when the scenario does not exist', async () => {
      AIPlaygroundScenarios.findOne.mockReturnValue({
        lean: () => Promise.resolve(null),
      });
      await expect(
        runService.listRunsForScenario('missing')
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('setRunFeedback', () => {
    it('persists the feedback with ratedBy/ratedAt', async () => {
      const doc = mockRunDoc();
      AIPlaygroundRuns.findById.mockResolvedValue(doc);
      const userId = new Types.ObjectId();
      await runService.setRunFeedback(
        doc._id,
        { rating: 'positive', score: 5, comment: 'great' },
        userId
      );
      expect(doc.feedback.rating).toBe('positive');
      expect(doc.feedback.score).toBe(5);
      expect(doc.feedback.ratedBy).toBe(userId);
      expect(doc.feedback.ratedAt).toBeInstanceOf(Date);
      expect(doc.save).toHaveBeenCalled();
    });
  });

  describe('markGolden', () => {
    it('demotes the previous golden run, flips the new one, updates scenario.goldenRunId', async () => {
      const doc = mockRunDoc();
      AIPlaygroundRuns.findById.mockResolvedValue(doc);
      AIPlaygroundRuns.updateMany.mockResolvedValue({});
      AIPlaygroundScenarios.updateOne.mockResolvedValue({});
      await runService.markGolden(doc._id);
      expect(AIPlaygroundRuns.updateMany).toHaveBeenCalledWith(
        { _scenario: doc._scenario, isGolden: true },
        { $set: { isGolden: false } }
      );
      expect(doc.isGolden).toBe(true);
      expect(AIPlaygroundScenarios.updateOne).toHaveBeenCalledWith(
        { _id: doc._scenario },
        { $set: { goldenRunId: doc._id } }
      );
    });

    it('is a no-op when the run is already golden', async () => {
      const doc = mockRunDoc({ isGolden: true });
      AIPlaygroundRuns.findById.mockResolvedValue(doc);
      await runService.markGolden(doc._id);
      expect(AIPlaygroundRuns.updateMany).not.toHaveBeenCalled();
      expect(AIPlaygroundScenarios.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('unmarkGolden', () => {
    it('flips isGolden off and clears scenario.goldenRunId', async () => {
      const doc = mockRunDoc({ isGolden: true });
      AIPlaygroundRuns.findById.mockResolvedValue(doc);
      AIPlaygroundScenarios.updateOne.mockResolvedValue({});
      await runService.unmarkGolden(doc._id);
      expect(doc.isGolden).toBe(false);
      expect(AIPlaygroundScenarios.updateOne).toHaveBeenCalledWith(
        { _id: doc._scenario, goldenRunId: doc._id },
        { $set: { goldenRunId: null } }
      );
    });
  });

  describe('deleteRun', () => {
    it('clears scenario.goldenRunId when deleting the golden run', async () => {
      const doc = mockRunDoc({ isGolden: true });
      AIPlaygroundRuns.findById.mockResolvedValue(doc);
      AIPlaygroundScenarios.updateOne.mockResolvedValue({});
      AIPlaygroundRuns.deleteOne.mockResolvedValue({});
      await runService.deleteRun(doc._id);
      expect(AIPlaygroundScenarios.updateOne).toHaveBeenCalled();
      expect(AIPlaygroundRuns.deleteOne).toHaveBeenCalledWith({ _id: doc._id });
    });
  });
});
