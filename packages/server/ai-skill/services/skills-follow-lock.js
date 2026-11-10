'use strict';

/**
 * The record of each follow of production (ADR 0019), which is also its
 * lock: a follow starts by recording itself as running, and the database
 * holds one running follow at most (a partial unique index), whatever
 * process or instance runs it, the button's or the night's. A running
 * follow that outlives its time, its process gone, is recorded as
 * interrupted by the next one.
 */

const createError = require('http-errors');
const ERROR_CODES = require('../../constant/error-codes.js');
const { SkillsFollows } = require('../../common/models.common.js');

// A follow reads one answer and writes some sixty items: minutes would
// already say something is wrong.
const LOCK_MS = 10 * 60 * 1000;
const RUNNING = 'running';

const running = () => createError(409, ERROR_CODES.SKILLS_FOLLOW_RUNNING);

/**
 * Records a follow as running, or refuses while another one runs.
 *
 * @param {Object} follow
 * @param {{ id?: string, name?: string }} follow.actor
 * @param {'manual'|'night'} follow.trigger
 * @param {Date} follow.startedAt
 * @returns {Promise<Object>} the running follow
 * @throws {HttpError} 409 SKILLS_FOLLOW_RUNNING
 */
async function takeLock({ actor, trigger, startedAt }) {
  await SkillsFollows.updateMany(
    { status: RUNNING, expiresAt: { $lt: startedAt } },
    {
      $set: {
        status: 'failed',
        reason: 'interrupted',
        code: ERROR_CODES.SKILLS_FOLLOW_INTERRUPTED,
        finishedAt: startedAt,
      },
    }
  );
  // The index refuses a second one; asked first, for a clear answer.
  if (await SkillsFollows.exists({ status: RUNNING })) throw running();
  try {
    return await SkillsFollows.create({
      status: RUNNING,
      trigger,
      by: actor.name || '',
      _by: actor.id || null,
      startedAt,
      expiresAt: new Date(startedAt.getTime() + LOCK_MS),
    });
  } catch (err) {
    if (err && err.code === 11000) throw running();
    throw err;
  }
}

/**
 * Records how a follow ended, which releases its lock.
 *
 * @param {Object} lock the running follow (takeLock)
 * @param {Object} report
 * @returns {Promise<Object>} the report
 */
async function record(lock, report) {
  await SkillsFollows.findOneAndUpdate(
    { _id: lock._id },
    { $set: { ...report, finishedAt: new Date() } }
  );
  return report;
}

/**
 * The follow running now, as the copy's page shows it, or null.
 *
 * @returns {Promise<Object|null>}
 */
async function runningFollow() {
  const lock = await SkillsFollows.findOne({
    status: RUNNING,
    expiresAt: { $gte: new Date() },
  }).lean();
  if (!lock) return null;
  const { startedAt, expiresAt, trigger, by } = lock;
  return { startedAt, expiresAt, trigger, by };
}

// An item of the report as stored, without the fields it does not hold.
const entryOf = (entry) =>
  Object.fromEntries(
    Object.entries(entry).filter(
      ([, value]) => value !== undefined && value !== null
    )
  );
const BUCKETS = [
  'created',
  'updated',
  'upToDate',
  'kept',
  'moved',
  'removed',
  'failed',
];

/**
 * The last follow that ended, as the copy's page shows it: how it ended,
 * when, by whom, and the report of each item, as the follow answered it
 * (`created`, `updated`, `upToDate`, `kept`, `moved`, `removed`, `failed`,
 * the latter also as `failures`).
 *
 * @returns {Promise<Object|null>}
 */
async function lastFollow() {
  const last = await SkillsFollows.findOne({ status: { $ne: RUNNING } })
    .sort({ startedAt: -1 })
    .lean();
  if (!last) return null;
  const follow = {
    status: last.status,
    trigger: last.trigger || 'manual',
    reason: last.reason || null,
    code: last.code || null,
    origin: last.origin || '',
    by: last.by,
    at: last.finishedAt,
  };
  BUCKETS.forEach((bucket) => {
    follow[bucket] = (last[bucket] || []).map(entryOf);
  });
  follow.failures = follow.failed;
  return follow;
}

/**
 * Whether a night's follow started since `since`, running or ended: the
 * scheduler runs the nightly command on every instance, and the one that
 * starts after the first ended must not follow again, nor hide the night's
 * report under an "all up to date" one.
 *
 * @param {Date} since
 * @returns {Promise<boolean>}
 */
async function nightFollowedSince(since) {
  return !!(await SkillsFollows.exists({
    trigger: 'night',
    startedAt: { $gte: since },
  }));
}

module.exports = {
  takeLock,
  record,
  runningFollow,
  lastFollow,
  nightFollowedSince,
  LOCK_MS,
};
