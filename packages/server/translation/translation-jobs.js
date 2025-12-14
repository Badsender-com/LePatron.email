'use strict';

/**
 * Translation Jobs Store
 *
 * Simple in-memory store for tracking translation job progress.
 * Jobs are automatically cleaned up after 10 minutes.
 */

const { v4: uuidv4 } = require('uuid');

// In-memory storage for jobs
const jobs = new Map();

// Job statuses
const JobStatus = {
  PENDING: 'pending',
  TRANSLATING: 'translating',
  GENERATING_PREVIEW: 'generating_preview',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

// TTL for jobs (10 minutes)
const JOB_TTL_MS = 10 * 60 * 1000;

/**
 * Create a new translation job
 * @param {Object} params - Job parameters
 * @param {number} params.totalKeys - Total number of keys to translate
 * @param {number} params.totalBatches - Total number of batches
 * @returns {Object} The created job
 */
function createJob({ totalKeys, totalBatches }) {
  const jobId = uuidv4();
  const now = Date.now();

  const job = {
    jobId,
    status: JobStatus.PENDING,
    progress: {
      currentBatch: 0,
      totalBatches,
      keysTranslated: 0,
      totalKeys,
    },
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };

  jobs.set(jobId, job);
  return job;
}

/**
 * Get a job by ID
 * @param {string} jobId - Job ID
 * @returns {Object|null} The job or null if not found
 */
function getJob(jobId) {
  return jobs.get(jobId) || null;
}

/**
 * Update job progress after a batch is translated
 * @param {string} jobId - Job ID
 * @param {number} batchNumber - Current batch number (1-indexed)
 * @param {number} keysInBatch - Number of keys translated in this batch
 */
function updateBatchProgress(jobId, batchNumber, keysInBatch) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = JobStatus.TRANSLATING;
  job.progress.currentBatch = batchNumber;
  job.progress.keysTranslated += keysInBatch;
  job.updatedAt = Date.now();
}

/**
 * Mark job as generating preview
 * @param {string} jobId - Job ID
 */
function setGeneratingPreview(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = JobStatus.GENERATING_PREVIEW;
  job.updatedAt = Date.now();
}

/**
 * Mark job as completed
 * @param {string} jobId - Job ID
 * @param {Object} result - Job result
 * @param {string} result.mailingId - Created mailing ID
 * @param {string} result.mailingName - Created mailing name
 * @param {boolean} result.previewGenerated - Whether preview was generated
 * @param {Object} result.stats - Translation stats
 * @param {Array<string>} result.warnings - Post-translation warnings
 */
function setCompleted(jobId, result) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = JobStatus.COMPLETED;
  job.result = result;
  job.updatedAt = Date.now();
}

/**
 * Mark job as failed
 * @param {string} jobId - Job ID
 * @param {string} errorMessage - Error message
 */
function setFailed(jobId, errorMessage) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = JobStatus.FAILED;
  job.error = errorMessage;
  job.updatedAt = Date.now();
}

/**
 * Delete a job
 * @param {string} jobId - Job ID
 */
function deleteJob(jobId) {
  jobs.delete(jobId);
}

/**
 * Cancel a job
 * @param {string} jobId - Job ID
 * @returns {boolean} True if job was cancelled, false if not found or already completed
 */
function cancelJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return false;

  // Cannot cancel if already completed or failed
  if (
    job.status === JobStatus.COMPLETED ||
    job.status === JobStatus.FAILED ||
    job.status === JobStatus.CANCELLED
  ) {
    return false;
  }

  job.status = JobStatus.CANCELLED;
  job.updatedAt = Date.now();
  return true;
}

/**
 * Check if a job has been cancelled
 * @param {string} jobId - Job ID
 * @returns {boolean} True if job is cancelled
 */
function isCancelled(jobId) {
  const job = jobs.get(jobId);
  return job && job.status === JobStatus.CANCELLED;
}

/**
 * Clean up old jobs (called periodically)
 */
function cleanupOldJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.updatedAt > JOB_TTL_MS) {
      jobs.delete(id);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupOldJobs, 60000);

module.exports = {
  JobStatus,
  createJob,
  getJob,
  updateBatchProgress,
  setGeneratingPreview,
  setCompleted,
  setFailed,
  deleteJob,
  cancelJob,
  isCancelled,
};
