'use strict';

const createError = require('http-errors');
const { Types } = require('mongoose');
const logger = require('../../utils/logger.js');
const { AISkillInvocations } = require('../../common/models.common.js');
const { computeExpiresAt } = require('./invocation-logger.service.js');

// Reserved non-productive invocation sources (cf. docs/AI_SKILL_AUTHORING.md):
// excluded from the Invocations list by default so test traffic does not
// drown real feature analytics. The UI exposes an opt-in toggle.
// 'admin-test' is kept for historical logs only — the super-admin Test runner
// that produced it was removed; no new code emits this source.
const NonProductiveSources = ['admin-test', 'playground'];
const NonProductivePrefixRegex = /^poc\./;

// Whitelisted sort fields. The sort runs in Mongo, so a client-supplied field
// name must never reach the query as-is. Computed columns (token total, group
// name, version) and unindexed ones stay out; the UI marks them non-sortable.
const SortableFields = [
  'startedAt',
  'skillId',
  'invocationSource',
  'status',
  'latencyMs',
  'provider',
];
const DefaultSort = Object.freeze({ startedAt: -1 });

/**
 * @returns {Object} a Mongo sort spec — the default when the requested field is
 * absent or not whitelisted.
 */
function buildSort(sortBy, sortDesc) {
  const field = Array.isArray(sortBy) ? sortBy[0] : sortBy;
  if (!field || !SortableFields.includes(field)) return DefaultSort;
  const desc = Array.isArray(sortDesc) ? sortDesc[0] : sortDesc;
  return { [field]: desc === true || desc === 'true' ? -1 : 1 };
}

const LIST_PROJECTION = {
  skillId: 1,
  skillVersion: 1,
  invocationSource: 1,
  _company: 1,
  _user: 1,
  provider: 1,
  model: 1,
  status: 1,
  startedAt: 1,
  completedAt: 1,
  latencyMs: 1,
  tokenUsage: 1,
  'error.code': 1,
  'error.message': 1,
};

async function listInvocations({
  skillId,
  invocationSource,
  status,
  groupId,
  startedFrom,
  startedTo,
  includeNonProductive,
  page = 1,
  pageSize = 50,
  sortBy,
  sortDesc,
} = {}) {
  const query = {};
  if (skillId) query.skillId = skillId;
  if (invocationSource) {
    // An explicit source filter always wins over the default exclusion
    // (filtering on 'playground' means you want to see playground runs).
    query.invocationSource = invocationSource;
  } else if (includeNonProductive !== true && includeNonProductive !== 'true') {
    query.invocationSource = {
      $nin: NonProductiveSources,
      $not: NonProductivePrefixRegex,
    };
  }
  if (status) query.status = status;
  if (groupId) query._company = groupId;
  if (startedFrom || startedTo) {
    query.startedAt = {};
    if (startedFrom) query.startedAt.$gte = new Date(startedFrom);
    if (startedTo) query.startedAt.$lte = new Date(startedTo);
  }
  const limit = Math.min(Math.max(parseInt(pageSize, 10) || 50, 1), 200);
  const skip = Math.max((parseInt(page, 10) || 1) - 1, 0) * limit;

  const [items, total] = await Promise.all([
    AISkillInvocations.find(query, LIST_PROJECTION)
      .sort(buildSort(sortBy, sortDesc))
      .skip(skip)
      .limit(limit)
      .populate('_company', 'name')
      .lean(),
    AISkillInvocations.countDocuments(query),
  ]);
  return { items, total, page: Math.floor(skip / limit) + 1, pageSize: limit };
}

// Written in batches rather than one update per document, and without an
// aggregation-pipeline update: those need MongoDB 4.2 while the project
// documents 3.4 as its minimum (packages/documentation/development.md).
const RESTAMP_BATCH_SIZE = 500;

/**
 * Re-stamp the retention deadline of every invocation of a Group.
 *
 * `expiresAt` is computed at write time, so changing a Group's
 * logRetentionDays would otherwise apply to new logs only. The nightly purge
 * this TTL index replaced recomputed the cutoff on every run, so tightening a
 * retention took effect retroactively — this restores that property, which is
 * the one RGPD-relevant thing the TTL lost.
 *
 * @param {Object} params
 * @param {import('mongoose').Types.ObjectId|string} params.groupId
 * @param {number} params.retentionDays
 * @returns {Promise<{ restamped: number }>}
 */
async function restampRetention({ groupId, retentionDays }) {
  const docs = await AISkillInvocations.find(
    { _company: Types.ObjectId(groupId) },
    { startedAt: 1 }
  ).lean();
  if (!docs.length) return { restamped: 0 };

  let restamped = 0;
  for (let i = 0; i < docs.length; i += RESTAMP_BATCH_SIZE) {
    const batch = docs.slice(i, i + RESTAMP_BATCH_SIZE);
    await AISkillInvocations.bulkWrite(
      batch.map((doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: { expiresAt: computeExpiresAt(doc.startedAt, retentionDays) },
          },
        },
      }))
    );
    restamped += batch.length;
  }

  logger.log(
    `[ai-skill] retention re-stamped for group=${groupId} days=${retentionDays} invocations=${restamped}`
  );
  return { restamped };
}

async function getInvocation(id) {
  const inv = await AISkillInvocations.findById(id).lean();
  if (!inv) throw createError(404, 'Invocation not found');
  return inv;
}

module.exports = {
  listInvocations,
  getInvocation,
  restampRetention,
  SortableFields,
};
