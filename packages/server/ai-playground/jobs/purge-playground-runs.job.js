'use strict';

const logger = require('../../utils/logger.js');
const { AIPlaygroundRuns } = require('../../common/models.common.js');
const {
  DefaultPlaygroundRunRetentionDays,
} = require('../constant/playground-constants.js');

const JOB_NAME = 'ai-playground:purge-runs';

/**
 * Delete AIPlaygroundRun documents older than the retention window. Runs
 * flagged isGolden === true are NEVER purged — they are durable references
 * for regression / comparison and we accept their long-term storage cost.
 *
 * @returns {Promise<{ deleted: number, retentionDays: number }>}
 */
async function purgePlaygroundRuns({
  now = new Date(),
  retentionDays = DefaultPlaygroundRunRetentionDays,
} = {}) {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await AIPlaygroundRuns.deleteMany({
    createdAt: { $lt: cutoff },
    isGolden: { $ne: true },
  });
  if (result && result.deletedCount) {
    logger.log(
      `[ai-playground purge] cutoff=${cutoff.toISOString()} deleted=${
        result.deletedCount
      }`
    );
  }
  return { deleted: (result && result.deletedCount) || 0, retentionDays };
}

function registerJob(scheduler, { schedule = '0 4 * * *' } = {}) {
  scheduler.define(JOB_NAME, async () => {
    try {
      await purgePlaygroundRuns();
    } catch (err) {
      logger.error('[ai-playground purge] failed:', err.message);
    }
  });
  return { name: JOB_NAME, schedule };
}

module.exports = { purgePlaygroundRuns, registerJob, JOB_NAME };
