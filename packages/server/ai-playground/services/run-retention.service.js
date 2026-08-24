'use strict';

const {
  DefaultPlaygroundRunRetentionDays,
} = require('../constant/playground-constants.js');

const DayInMs = 24 * 60 * 60 * 1000;

/**
 * Deadline stamped on AIPlaygroundRun.expiresAt, enforced by the TTL index on
 * the schema. Retention is a fixed window from the run's creation, so a run
 * whose window already closed while it was golden gets a deadline in the past
 * on unmark — on purpose: the deletion that should have happened never did.
 *
 * @param {Date} createdAt
 * @param {number} [retentionDays]
 * @returns {Date}
 */
function runExpiresAt(
  createdAt,
  retentionDays = DefaultPlaygroundRunRetentionDays
) {
  return new Date(createdAt.getTime() + retentionDays * DayInMs);
}

module.exports = { runExpiresAt, DayInMs };
