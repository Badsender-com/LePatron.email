'use strict';

const createError = require('http-errors');
const { AISkillInvocations } = require('../../common/models.common.js');

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

async function getInvocation(id) {
  const inv = await AISkillInvocations.findById(id).lean();
  if (!inv) throw createError(404, 'Invocation not found');
  return inv;
}

module.exports = {
  listInvocations,
  getInvocation,
  SortableFields,
};
