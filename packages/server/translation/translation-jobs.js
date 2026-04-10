'use strict';

/**
 * Translation Jobs Store
 *
 * MongoDB-backed store for tracking translation job progress.
 * A TTL index on `updatedAt` auto-removes jobs 10 minutes after their last update.
 * Note: the in memory store version is incompatible with clever multiple workers.
 */

const { v4: uuidv4 } = require('uuid');

const { TranslationJobs } = require('../common/models.common');

const JobStatus = {
  PENDING: 'pending',
  TRANSLATING: 'translating',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

/**
 * Create a new translation job
 * @param {Object} params - Job parameters
 * @param {string} params.userId - Owner user ID for authorization
 * @returns {Promise<Object>} The created job
 */
async function createJob({ userId }) {
  const doc = await TranslationJobs.create({
    jobId: uuidv4(),
    userId,
    status: JobStatus.PENDING,
    progress: {
      currentBatch: 0,
      totalBatches: 0,
      keysTranslated: 0,
      totalKeys: 0,
    },
  });
  return doc.toObject();
}

/**
 * Set the totals on a job once they are known (after extraction + batching)
 * @param {string} jobId - Job ID
 * @param {{ totalKeys: number, totalBatches: number }} totals
 */
async function setTotals(jobId, { totalKeys, totalBatches }) {
  await TranslationJobs.updateOne(
    { jobId },
    {
      $set: {
        'progress.totalKeys': totalKeys,
        'progress.totalBatches': totalBatches,
      },
    }
  );
}

/**
 * Get a job by ID
 * @param {string} jobId - Job ID
 * @returns {Promise<Object|null>} The job or null if not found
 */
async function getJob(jobId) {
  const doc = await TranslationJobs.findOne({ jobId }).lean();
  return doc || null;
}

/**
 * Update job progress after a batch is translated
 * @param {string} jobId - Job ID
 * @param {number} batchNumber - Current batch number (1-indexed)
 * @param {number} keysInBatch - Number of keys translated in this batch
 */
async function updateBatchProgress(jobId, batchNumber, keysInBatch) {
  await TranslationJobs.updateOne(
    { jobId },
    {
      $set: {
        status: JobStatus.TRANSLATING,
        'progress.currentBatch': batchNumber,
      },
      $inc: { 'progress.keysTranslated': keysInBatch },
    }
  );
}

/**
 * Mark job as completed
 * @param {string} jobId - Job ID
 * @param {Object} result - Job result
 */
async function setCompleted(jobId, result) {
  await TranslationJobs.updateOne(
    { jobId },
    { $set: { status: JobStatus.COMPLETED, result } }
  );
}

/**
 * Mark job as failed
 * @param {string} jobId - Job ID
 * @param {string} errorMessage - Error message
 */
async function setFailed(jobId, errorMessage) {
  await TranslationJobs.updateOne(
    { jobId },
    { $set: { status: JobStatus.FAILED, error: errorMessage } }
  );
}

/**
 * Delete a job
 * @param {string} jobId - Job ID
 */
async function deleteJob(jobId) {
  await TranslationJobs.deleteOne({ jobId });
}

/**
 * Cancel a job atomically (only if still pending/translating)
 * @param {string} jobId - Job ID
 * @returns {Promise<boolean>} True if job was cancelled, false otherwise
 */
async function cancelJob(jobId) {
  const res = await TranslationJobs.updateOne(
    {
      jobId,
      status: { $in: [JobStatus.PENDING, JobStatus.TRANSLATING] },
    },
    { $set: { status: JobStatus.CANCELLED } }
  );
  const modified =
    typeof res.modifiedCount === 'number' ? res.modifiedCount : res.nModified;
  return modified > 0;
}

/**
 * Check if a job has been cancelled
 * @param {string} jobId - Job ID
 * @returns {Promise<boolean>} True if job is cancelled
 */
async function isCancelled(jobId) {
  const doc = await TranslationJobs.findOne(
    { jobId, status: JobStatus.CANCELLED },
    { _id: 1 }
  ).lean();
  return !!doc;
}

module.exports = {
  JobStatus,
  createJob,
  setTotals,
  getJob,
  updateBatchProgress,
  setCompleted,
  setFailed,
  deleteJob,
  cancelJob,
  isCancelled,
};
