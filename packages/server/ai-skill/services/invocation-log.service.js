'use strict';

const createError = require('http-errors');
const { AISkillInvocations } = require('../../common/models.common.js');

// Reserved non-productive featureTypes (cf. docs/AI_SKILL_AUTHORING.md):
// excluded from the Invocations list by default so test traffic does not
// drown real feature analytics. The UI exposes an opt-in toggle.
const NonProductiveFeatureTypes = ['admin-test', 'playground'];
const NonProductivePrefixRegex = /^poc\./;

const LIST_PROJECTION = {
  skillId: 1,
  skillVersion: 1,
  featureType: 1,
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
  featureType,
  status,
  groupId,
  startedFrom,
  startedTo,
  includeNonProductive,
  page = 1,
  pageSize = 50,
} = {}) {
  const query = {};
  if (skillId) query.skillId = skillId;
  if (featureType) {
    // An explicit featureType filter always wins over the default exclusion
    // (filtering on 'playground' means you want to see playground runs).
    query.featureType = featureType;
  } else if (includeNonProductive !== true && includeNonProductive !== 'true') {
    query.featureType = {
      $nin: NonProductiveFeatureTypes,
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
      .sort({ startedAt: -1 })
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

module.exports = { listInvocations, getInvocation };
