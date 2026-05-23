'use strict';

const logger = require('../../utils/logger.js');
const { Groups, AISkillInvocations } = require('../../common/models.common.js');
const { DefaultLogRetentionDays } = require('../constant/skill-constants.js');

const JOB_NAME = 'ai-skill:purge-invocations';

/**
 * Walk every Group and delete AISkillInvocation documents older than the
 * Group's `logRetentionDays`. Runs as a daily cron via Agenda. Pure function:
 * the same input state always produces the same delete count.
 *
 * @returns {Promise<{ groupsProcessed: number, deleted: number }>}
 */
async function purgeInvocations({ now = new Date() } = {}) {
  const groups = await Groups.find({}, { _id: 1, logRetentionDays: 1 }).lean();

  let deleted = 0;
  for (const group of groups) {
    const retentionDays = group.logRetentionDays || DefaultLogRetentionDays;
    const cutoff = new Date(
      now.getTime() - retentionDays * 24 * 60 * 60 * 1000
    );
    const result = await AISkillInvocations.deleteMany({
      _company: group._id,
      startedAt: { $lt: cutoff },
    });
    if (result && result.deletedCount) {
      logger.log(
        `[ai-skill purge] group=${
          group._id
        } cutoff=${cutoff.toISOString()} deleted=${result.deletedCount}`
      );
      deleted += result.deletedCount;
    }
  }
  return { groupsProcessed: groups.length, deleted };
}

function registerJob(scheduler, { schedule = '0 3 * * *' } = {}) {
  scheduler.define(JOB_NAME, async () => {
    try {
      const out = await purgeInvocations();
      logger.log(
        `[ai-skill purge] complete — groups=${out.groupsProcessed} deleted=${out.deleted}`
      );
    } catch (err) {
      logger.error('[ai-skill purge] failed:', err.message);
    }
  });
  return { name: JOB_NAME, schedule };
}

module.exports = { purgeInvocations, registerJob, JOB_NAME };
