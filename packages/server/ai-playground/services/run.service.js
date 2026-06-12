'use strict';

const createError = require('http-errors');
const {
  AIPlaygroundRuns,
  AIPlaygroundScenarios,
} = require('../../common/models.common.js');
const { FeedbackRatingValues } = require('../constant/playground-constants.js');

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
  // Validate up front: a bad rating/score must answer 400, not surface as a
  // Mongoose ValidationError turned 500.
  if (feedback.rating && !FeedbackRatingValues.includes(feedback.rating)) {
    throw createError(
      400,
      `rating must be one of: ${FeedbackRatingValues.join(', ')}`
    );
  }
  const score = feedback.score;
  if (score != null && !(Number.isFinite(score) && score >= 1 && score <= 5)) {
    throw createError(400, 'score must be a number between 1 and 5');
  }
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
 * Mark a run as the golden reference for its scenario:
 *  1. Unmark the previously golden run for this scenario (if any).
 *  2. Mark the new run as golden.
 *  3. Update scenario.goldenRunId.
 * NOT atomic (no transaction): the partial-unique index on
 * { _scenario, isGolden: true } is the backstop — two concurrent markGolden
 * calls on the same scenario make the loser fail on E11000, answered as a
 * 409 the caller can simply retry.
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
  try {
    await run.save();
  } catch (err) {
    if (err && err.code === 11000) {
      throw createError(
        409,
        'Another run was just marked golden for this scenario — retry'
      );
    }
    throw err;
  }
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
