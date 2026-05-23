'use strict';

const { Types } = require('mongoose');

jest.mock('../../../../packages/server/common/models.common', () => ({
  Users: { findOneAndUpdate: jest.fn(), findById: jest.fn() },
}));

const testBudget = require('../../../../packages/server/ai-skill/services/test-budget.service');
const { Users } = require('../../../../packages/server/common/models.common');

beforeEach(() => {
  jest.clearAllMocks();
  testBudget._resetAdminBudgetForTests();
});

describe('test-budget', () => {
  describe('consumeBudget', () => {
    it('uses an in-memory counter when userId is null (admin pseudo-user)', async () => {
      const a = await testBudget.consumeBudget(null);
      const b = await testBudget.consumeBudget(null);
      expect(Users.findOneAndUpdate).not.toHaveBeenCalled();
      expect(a.count).toBe(1);
      expect(b.count).toBe(2);
    });

    it('throws 429 when admin in-memory counter exceeds the cap', async () => {
      const max = 2;
      await testBudget.consumeBudget(null, max);
      await testBudget.consumeBudget(null, max);
      await expect(testBudget.consumeBudget(null, max)).rejects.toMatchObject({
        status: 429,
      });
    });

    it('resets the admin counter on a new day', async () => {
      const yesterday = new Date('2026-01-01T12:00:00Z');
      const today = new Date('2026-01-02T12:00:00Z');
      const a = await testBudget.consumeBudget(null, 50, yesterday);
      expect(a.count).toBe(1);
      const b = await testBudget.consumeBudget(null, 50, today);
      expect(b.count).toBe(1);
    });

    it('returns the post-increment count below the cap', async () => {
      const userId = new Types.ObjectId();
      Users.findOneAndUpdate.mockResolvedValue({
        dailyTestInvocationCount: { date: testBudget.todayKey(), count: 3 },
      });
      const out = await testBudget.consumeBudget(userId, 50);
      expect(out.count).toBe(3);
      expect(out.remaining).toBe(47);
    });

    it('throws 429 when the cap is exceeded', async () => {
      const userId = new Types.ObjectId();
      Users.findOneAndUpdate.mockResolvedValue({
        dailyTestInvocationCount: { date: testBudget.todayKey(), count: 51 },
      });
      await expect(testBudget.consumeBudget(userId, 50)).rejects.toMatchObject({
        status: 429,
      });
    });

    it('throws 404 when user is missing', async () => {
      Users.findOneAndUpdate.mockResolvedValue(null);
      await expect(
        testBudget.consumeBudget(new Types.ObjectId())
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('getBudget', () => {
    it('returns the admin in-memory count when userId is null', async () => {
      await testBudget.consumeBudget(null);
      await testBudget.consumeBudget(null);
      const out = await testBudget.getBudget(null);
      expect(out.count).toBe(2);
    });

    it('returns count=0 when no bucket exists', async () => {
      Users.findById.mockReturnValue({ lean: () => Promise.resolve({}) });
      const out = await testBudget.getBudget(new Types.ObjectId());
      expect(out.count).toBe(0);
    });

    it('resets count when bucket is from a previous day', async () => {
      Users.findById.mockReturnValue({
        lean: () =>
          Promise.resolve({
            dailyTestInvocationCount: { date: '2000-01-01', count: 99 },
          }),
      });
      const out = await testBudget.getBudget(new Types.ObjectId());
      expect(out.count).toBe(0);
    });

    it('returns today bucket count', async () => {
      Users.findById.mockReturnValue({
        lean: () =>
          Promise.resolve({
            dailyTestInvocationCount: { date: testBudget.todayKey(), count: 7 },
          }),
      });
      const out = await testBudget.getBudget(new Types.ObjectId());
      expect(out.count).toBe(7);
    });
  });
});
