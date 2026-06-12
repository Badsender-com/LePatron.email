'use strict';

const createError = require('http-errors');
const { Users } = require('../../common/models.common.js');
const { MaxDailyTestInvocations } = require('../constant/skill-constants.js');

function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

// In-memory counter for the pseudo-admin user (config.admin has no User row).
// Resets on a new day or on process restart, and is PER-PROCESS: in a
// multi-instance deployment each instance has its own admin budget. Known
// and accepted limit — sufficient to stop runaway loops from burning the LLM
// budget; not a strong audit log (use AISkillInvocation for that).
// See PLAN-IMPLEMENTATION-V1 §5.4.
const adminBudget = { date: null, count: 0 };

function _resetAdminBudgetForTests() {
  adminBudget.date = null;
  adminBudget.count = 0;
}

/**
 * Atomically check-and-increment the per-user daily test-invocation counter.
 * Throws 429 when the budget is exhausted. For the admin pseudo-user
 * (`userId` falsy), uses an in-memory counter so super-admins are also
 * rate-limited.
 */
async function consumeBudget(
  userId,
  max = MaxDailyTestInvocations,
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
        `Daily test invocation budget exceeded (max ${max}/day)`
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
      `Daily test invocation budget exceeded (max ${max}/day)`
    );
  }
  return { count, max, remaining: max - count };
}

async function getBudget(
  userId,
  max = MaxDailyTestInvocations,
  now = new Date()
) {
  const today = todayKey(now);
  if (!userId) {
    const count = adminBudget.date === today ? adminBudget.count : 0;
    return { count, max, remaining: max - count };
  }
  const user = await Users.findById(userId, {
    dailyTestInvocationCount: 1,
  }).lean();
  if (!user) return { count: 0, max, remaining: max };
  const bucket = user.dailyTestInvocationCount || {};
  const count = bucket.date === today ? bucket.count || 0 : 0;
  return { count, max, remaining: max - count };
}

module.exports = {
  consumeBudget,
  getBudget,
  todayKey,
  _resetAdminBudgetForTests,
};
