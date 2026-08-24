'use strict';

const createError = require('http-errors');
const { Users } = require('../../common/models.common.js');
const {
  MaxDailyPlaygroundRuns,
} = require('../constant/playground-constants.js');

function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

// In-memory counter for the pseudo-admin user (config.admin has no User row).
// Resets on a new day or on process restart, and is PER-PROCESS: in a
// multi-instance deployment each instance has its own admin budget. Known
// and accepted limit — sufficient to stop runaway loops from burning the LLM
// budget; not a strong audit log (use AISkillInvocation for that).
const adminBudget = { date: null, count: 0 };

function _resetAdminBudgetForTests() {
  adminBudget.date = null;
  adminBudget.count = 0;
}

/**
 * Atomically check-and-increment the per-user daily run counter. Throws 429
 * when the budget is exhausted. For the admin pseudo-user (`userId` falsy),
 * uses an in-memory counter so super-admins are also rate-limited.
 */
async function consumeBudget(
  userId,
  max = MaxDailyPlaygroundRuns,
  now = new Date()
) {
  const today = todayKey(now);

  if (!userId) {
    if (adminBudget.date !== today) {
      adminBudget.date = today;
      adminBudget.count = 0;
    }
    adminBudget.count += 1;
    if (adminBudget.count > max) {
      throw createError(
        429,
        `Daily playground run budget exceeded (max ${max}/day)`
      );
    }
    return {
      count: adminBudget.count,
      max,
      remaining: max - adminBudget.count,
    };
  }

  // Atomic upsert + increment with day reset.
  const user = await Users.findOneAndUpdate(
    { _id: userId },
    [
      {
        $set: {
          dailyTestInvocationCount: {
            $cond: [
              { $eq: ['$dailyTestInvocationCount.date', today] },
              {
                date: today,
                count: { $add: ['$dailyTestInvocationCount.count', 1] },
              },
              { date: today, count: 1 },
            ],
          },
        },
      },
    ],
    { new: true, projection: { dailyTestInvocationCount: 1 } }
  );

  if (!user) throw createError(404, 'User not found');
  const count = user.dailyTestInvocationCount.count;
  if (count > max) {
    throw createError(
      429,
      `Daily playground run budget exceeded (max ${max}/day)`
    );
  }
  return { count, max, remaining: max - count };
}

module.exports = {
  consumeBudget,
  todayKey,
  _resetAdminBudgetForTests,
};
