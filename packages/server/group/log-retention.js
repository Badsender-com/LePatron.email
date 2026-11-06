'use strict';

const { Types } = require('mongoose');
const logger = require('../utils/logger.js');
const {
  AISkillInvocations,
  McpCallLogs,
  McpFeedbacks,
} = require('../common/models.common.js');
const {
  DefaultLogRetentionDays,
} = require('../ai-skill/constant/skill-constants.js');

/**
 * A company's log retention (`Group.logRetentionDays`), once: what each log
 * is stamped with when written, and what the logs already kept take when the
 * retention changes. Each log is removed by a TTL index on its `expiresAt`,
 * since the retention is a company's and cannot live in the index.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Written in batches rather than one update per document, and without an
// aggregation-pipeline update: those need MongoDB 4.2 while the project
// documents 3.4 as its minimum (packages/documentation/development.md).
const RESTAMP_BATCH_SIZE = 500;

// The logs a company's retention applies to, each with the date it counts
// from: the skill invocations, the MCP call logs and the feedbacks sent from
// connected applications (ADR 0012).
const LOGS = Object.freeze([
  { name: 'invocations', model: AISkillInvocations, dateField: 'startedAt' },
  { name: 'callLogs', model: McpCallLogs, dateField: 'createdAt' },
  { name: 'feedbacks', model: McpFeedbacks, dateField: 'createdAt' },
]);

/**
 * The end of a log's retention, which its TTL index removes it at.
 *
 * @param {Date} from when the log was written
 * @param {number} [retentionDays] the company's, the default when none
 * @returns {Date}
 */
function computeExpiresAt(from, retentionDays) {
  const days = retentionDays || DefaultLogRetentionDays;
  const start = from instanceof Date ? from : new Date();
  return new Date(start.getTime() + days * MS_PER_DAY);
}

/**
 * Re-stamps the end of retention of a company's logs in one collection, each
 * from its own date. The logs are read through a cursor and written in
 * batches: never all in memory at once.
 *
 * @param {import('mongoose').Model} model
 * @param {string} dateField the date each log counts from
 * @param {import('mongoose').Types.ObjectId|string} groupId
 * @param {number} [days]
 * @returns {Promise<number>} how many were re-stamped
 */
async function restamp(model, dateField, groupId, days) {
  const logs = model
    .find({ _company: Types.ObjectId(groupId) }, { [dateField]: 1 })
    .lean()
    .cursor();
  let batch = [];
  let restamped = 0;
  const write = async () => {
    await model.bulkWrite(
      batch.map((log) => ({
        updateOne: {
          filter: { _id: log._id },
          update: {
            $set: { expiresAt: computeExpiresAt(log[dateField], days) },
          },
        },
      }))
    );
    restamped += batch.length;
    batch = [];
  };
  for await (const log of logs) {
    batch.push(log);
    if (batch.length === RESTAMP_BATCH_SIZE) await write();
  }
  if (batch.length) await write();
  return restamped;
}

async function restampAll(groupId, retentionDays) {
  const counts = {};
  for (const { name, model, dateField } of LOGS) {
    // eslint-disable-next-line no-await-in-loop
    counts[name] = await restamp(model, dateField, groupId, retentionDays);
  }
  logger.log(
    `[group] log retention re-stamped for group=${groupId} days=${retentionDays} ${JSON.stringify(
      counts
    )}`
  );
  return counts;
}

// The re-stamping of each company, in this process: one runs at a time, and
// of those asked for while it runs, the last one alone runs after it.
const queues = new Map();

/**
 * Re-stamps every log of a company when its retention changes: `expiresAt`
 * is set at write time, and a shorter retention must reach what is already
 * kept, as the nightly purge the TTL indexes replaced did.
 *
 * Two changes close together never mix: the re-stampings of a company run
 * one after the other, and one asked for while another runs is skipped when
 * a later one is asked for before it starts, so the last retention asked for
 * is the one the logs end with. One that fails is the caller's to log: it is
 * not run again by itself, and the next change of the retention runs it all.
 *
 * @param {import('mongoose').Types.ObjectId|string} groupId
 * @param {number} retentionDays
 * @returns {Promise<Object|null>} how many were re-stamped, by log; null when
 *   a later change replaced this one before it ran
 */
function restampLogs(groupId, retentionDays) {
  const key = String(groupId);
  const queue = queues.get(key) || { last: Promise.resolve(), asked: 0 };
  queues.set(key, queue);
  queue.asked += 1;
  const turn = queue.asked;
  const run = queue.last.then(() =>
    turn === queue.asked ? restampAll(groupId, retentionDays) : null
  );
  queue.last = run.catch(() => null);
  queue.last.then(() => {
    if (turn === queue.asked) queues.delete(key);
  });
  return run;
}

module.exports = { computeExpiresAt, restamp, restampLogs, LOGS };
