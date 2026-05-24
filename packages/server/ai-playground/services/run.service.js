'use strict';

const createError = require('http-errors');
const {
  AIPlaygroundRuns,
  AIPlaygroundScenarios,
} = require('../../common/models.common.js');

const LIST_PROJECTION = {
  _scenario: 1,
  'resolvedSkill.skillId': 1,
  'resolvedSkill.versionMajor': 1,
  'resolvedSkill.versionMinor': 1,
  status: 1,
  latencyMs: 1,
  tokenUsage: 1,
  isGolden: 1,
  feedback: 1,
  errorMessage: 1,
  createdAt: 1,
  createdBy: 1,
};

async function listRunsForScenario(
  scenarioId,
  { status, startedFrom, startedTo, page = 1, pageSize = 50 } = {}
) {
  const scenario = await AIPlaygroundScenarios.findOne(
    { scenarioId },
    { _id: 1 }
  ).lean();
  if (!scenario) throw createError(404, `Scenario "${scenarioId}" not found`);
  const query = { _scenario: scenario._id };
  if (status) query.status = status;
  if (startedFrom || startedTo) {
    query.createdAt = {};
    if (startedFrom) query.createdAt.$gte = new Date(startedFrom);
    if (startedTo) query.createdAt.$lte = new Date(startedTo);
  }
  const limit = Math.min(Math.max(parseInt(pageSize, 10) || 50, 1), 200);
  const skip = Math.max((parseInt(page, 10) || 1) - 1, 0) * limit;
  const [items, total] = await Promise.all([
    AIPlaygroundRuns.find(query, LIST_PROJECTION)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AIPlaygroundRuns.countDocuments(query),
  ]);
  return { items, total, page: Math.floor(skip / limit) + 1, pageSize: limit };
}

async function getRun(runId) {
  const run = await AIPlaygroundRuns.findById(runId).lean();
  if (!run) throw createError(404, 'Run not found');
  return run;
}

async function setRunFeedback(runId, feedback, userId) {
  const run = await AIPlaygroundRuns.findById(runId);
  if (!run) throw createError(404, 'Run not found');
  run.feedback = {
    rating: feedback.rating,
    score: feedback.score,
    comment: feedback.comment,
    ratedBy: userId,
    ratedAt: new Date(),
  };
  await run.save();
  return run;
}

/**
 * Mark a run as the golden reference for its scenario. Atomic logic:
 *  1. Unmark the previously golden run for this scenario (if any). The DB
 *     partial-unique index on { _scenario, isGolden: true } makes this step
 *     mandatory before flipping the new one to avoid a write conflict.
 *  2. Mark the new run as golden.
 *  3. Update scenario.goldenRunId.
 */
async function markGolden(runId) {
  const run = await AIPlaygroundRuns.findById(runId);
  if (!run) throw createError(404, 'Run not found');
  if (run.isGolden) {
    return run;
  }
  await AIPlaygroundRuns.updateMany(
    { _scenario: run._scenario, isGolden: true },
    { $set: { isGolden: false } }
  );
  run.isGolden = true;
  await run.save();
  await AIPlaygroundScenarios.updateOne(
    { _id: run._scenario },
    { $set: { goldenRunId: run._id } }
  );
  return run;
}

async function unmarkGolden(runId) {
  const run = await AIPlaygroundRuns.findById(runId);
  if (!run) throw createError(404, 'Run not found');
  if (!run.isGolden) return run;
  run.isGolden = false;
  await run.save();
  await AIPlaygroundScenarios.updateOne(
    { _id: run._scenario, goldenRunId: run._id },
    { $set: { goldenRunId: null } }
  );
  return run;
}

async function deleteRun(runId) {
  const run = await AIPlaygroundRuns.findById(runId);
  if (!run) throw createError(404, 'Run not found');
  if (run.isGolden) {
    await AIPlaygroundScenarios.updateOne(
      { _id: run._scenario, goldenRunId: run._id },
      { $set: { goldenRunId: null } }
    );
  }
  await AIPlaygroundRuns.deleteOne({ _id: run._id });
  return { deleted: true };
}

module.exports = {
  listRunsForScenario,
  getRun,
  setRunFeedback,
  markGolden,
  unmarkGolden,
  deleteRun,
};
