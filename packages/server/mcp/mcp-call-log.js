'use strict';

const { McpCallLogs, Groups } = require('../common/models.common.js');
const { computeExpiresAt } = require('../group/log-retention.js');
const logger = require('../utils/logger.js');

/**
 * Writing the call log (ADR 0012), without the call waiting for it: a log
 * that cannot be written is logged, and the call answers all the same. A log
 * goes at the end of its company's log retention, which the identity of the
 * call gives, or, for a call without one, a reading kept a minute per
 * company.
 */

const RETENTION_KEPT_MS = 60 * 1000;
const MAX_RETENTIONS_KEPT = 10000;

// The log retention of each company, as last read: { days, at }.
const retentions = new Map();
// The writes not done yet, and the calls still running, for what stops the
// server (the stdio bridge) and the tests to wait for.
const pending = new Set();
const running = new Set();

function keepRetention(groupId, days) {
  if (retentions.size >= MAX_RETENTIONS_KEPT) retentions.clear();
  retentions.set(String(groupId), { days, at: Date.now() });
}

async function retentionOf(groupId) {
  const known = retentions.get(String(groupId));
  if (known && Date.now() - known.at < RETENTION_KEPT_MS) return known.days;
  const group = await Groups.findById(groupId)
    .select('logRetentionDays')
    .lean();
  keepRetention(groupId, group?.logRetentionDays);
  return group?.logRetentionDays;
}

async function write(entry, identity) {
  try {
    let days;
    if (identity) {
      days = identity.group.logRetentionDays;
      keepRetention(entry._company, days);
    } else if (entry._company) {
      days = await retentionOf(entry._company);
    }
    await McpCallLogs.create({
      ...entry,
      expiresAt: computeExpiresAt(new Date(), days),
    });
  } catch (err) {
    logger.error('[mcp] the call could not be logged', err.message);
  }
}

/**
 * Logs a call, in the background.
 *
 * @param {Object} entry what the log keeps of the call
 * @param {Object} [identity] who made it, when known (`identify`)
 */
function recordCall(entry, identity) {
  const writing = write(entry, identity);
  pending.add(writing);
  writing.then(() => pending.delete(writing));
}

/**
 * Resolves once the call logs started so far are written: for the tests,
 * which read the log right after a call.
 *
 * @returns {Promise<void>}
 */
async function callLogsWritten() {
  await Promise.all([...pending]);
}

/**
 * Counts a call as running until the function it answers is called, once
 * its log is started.
 *
 * @returns {Function} what says the call is over
 */
function callStarted() {
  const call = {};
  running.add(call);
  return () => running.delete(call);
}

/**
 * Resolves once no call is running and no call log is being written, the
 * logs of the calls that end meanwhile included: what a server waits for
 * before it stops.
 *
 * @param {Object} [options]
 * @param {number} [options.pollMs] how often the running calls are looked at
 * @returns {Promise<void>}
 */
async function callsAndLogsDone({ pollMs = 50 } = {}) {
  while (running.size || pending.size) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all([
      ...pending,
      new Promise((resolve) => setTimeout(resolve, pollMs)),
    ]);
  }
}

/**
 * Forgets the retention kept for a company, when it changes: the next call
 * log without an identity reads it again.
 *
 * @param {string} groupId
 */
function forgetRetention(groupId) {
  retentions.delete(String(groupId));
}

// For the tests: every company's retention read again.
function forgetRetentions() {
  retentions.clear();
}

module.exports = {
  recordCall,
  callLogsWritten,
  callStarted,
  callsAndLogsDone,
  forgetRetention,
  forgetRetentions,
};
