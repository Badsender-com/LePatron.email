'use strict';

const { Types } = require('mongoose');
const logger = require('../utils/logger.js');
const {
  McpCallLogs,
  McpFeedbacks,
  McpRetexes,
} = require('../common/models.common.js');
const {
  computeExpiresAt,
} = require('../ai-skill/services/invocation-logger.service.js');

// As for the skill invocations (invocation-log.service.js): batched, and
// without an aggregation-pipeline update, which needs MongoDB 4.2.
const RESTAMP_BATCH_SIZE = 500;

// `from` is the date the retention runs from: when it was written, or for a
// retex, when it was closed (an open one has no expiry, ADR 0021).
async function restamp(
  model,
  groupId,
  retentionDays,
  { filter = {}, from = 'createdAt' } = {}
) {
  const docs = await model
    .find({ _company: Types.ObjectId(groupId), ...filter }, { [from]: 1 })
    .lean();
  for (let i = 0; i < docs.length; i += RESTAMP_BATCH_SIZE) {
    // eslint-disable-next-line no-await-in-loop
    await model.bulkWrite(
      docs.slice(i, i + RESTAMP_BATCH_SIZE).map((doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: { expiresAt: computeExpiresAt(doc[from], retentionDays) },
          },
        },
      }))
    );
  }
  return docs.length;
}

/**
 * Re-stamps the deadline of a group's MCP call logs, feedbacks and closed
 * retex when its log
 * retention changes: `expiresAt` is set at write time, and a shorter retention
 * must reach what is already kept.
 *
 * @param {Object} params
 * @param {import('mongoose').Types.ObjectId|string} params.groupId
 * @param {number} params.retentionDays
 * @returns {Promise<{ callLogs: number, feedbacks: number, retex: number }>}
 *   how many were re-stamped
 */
async function restampMcpRetention({ groupId, retentionDays }) {
  const callLogs = await restamp(McpCallLogs, groupId, retentionDays);
  const feedbacks = await restamp(McpFeedbacks, groupId, retentionDays);
  const retex = await restamp(McpRetexes, groupId, retentionDays, {
    filter: { status: { $ne: 'open' } },
    from: 'closedAt',
  });
  logger.log(
    `[mcp] retention re-stamped for group=${groupId} days=${retentionDays} callLogs=${callLogs} feedbacks=${feedbacks} retex=${retex}`
  );
  return { callLogs, feedbacks, retex };
}

module.exports = { restampMcpRetention };
