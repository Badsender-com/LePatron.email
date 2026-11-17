'use strict';

// The export to an image host, run as a job (ADR 0029): started at once once
// what can be checked is checked, the images put in the background, its
// progress and outcome read by the user who started it.

const { v4: uuidv4 } = require('uuid');
const { NotFound, Conflict } = require('http-errors');
const { ImageHostExportJobs } = require('../common/models.common.js');
const mailingService = require('./mailing.service.js');
const ERROR_CODES = require('../constant/error-codes.js');
const logger = require('../utils/logger.js');

const HEARTBEAT_MS = 5000;
// A job silent for longer has lost its instance.
const SILENCE_MS = 20000;
// The codes of the export's own errors (ADR 0028): anything else is told as
// a failure, its text kept to the logs.
const OWN_ERROR_CODE = /^[A-Z][A-Z0-9_]+$/;

const userIdOf = (user) => String(user.id || user._id);

/**
 * Checks the export and starts it: the rights on the email, the image host
 * and the required tracking parameters answer the request; the images are
 * put afterwards.
 * @returns {Promise<{ jobId: string }>}
 */
async function startImageHostExport({
  mailingId,
  html,
  user,
  hostingIntegrationId,
  freshTracking,
}) {
  const prepared = await mailingService.prepareImageHostExport({
    mailingId,
    html,
    user,
    hostingIntegrationId,
    freshTracking,
  });
  const jobId = uuidv4();
  await ImageHostExportJobs.create({
    jobId,
    userId: userIdOf(user),
    _mailing: prepared.mailingId,
    _integration: prepared.integrationId,
    status: 'hosting',
    progress: { done: 0, total: prepared.imageCount },
    heartbeatAt: new Date(),
  });
  runJob(jobId, prepared);
  return { jobId };
}

// Never rejects: whatever happens is written on the job.
function runJob(jobId, prepared) {
  const update = ($set) =>
    ImageHostExportJobs.updateOne({ jobId }, { $set }).catch((error) =>
      logger.error('[EXPORT] image host job not updated', {
        jobId,
        error: error.message,
      })
    );
  const heartbeat = setInterval(
    () => update({ heartbeatAt: new Date() }),
    HEARTBEAT_MS
  );
  if (typeof heartbeat.unref === 'function') heartbeat.unref();

  return prepared
    .run(({ done, total }) =>
      update({ 'progress.done': done, 'progress.total': total })
    )
    .then((result) =>
      update({
        status: 'completed',
        result: { prefix: result.prefix, name: result.name, html: result.html },
      })
    )
    .catch((error) => {
      const own = OWN_ERROR_CODE.test(String(error.message));
      if (!own) {
        logger.error('[EXPORT] image host job failed', {
          jobId,
          error: error.message,
        });
      }
      return update({
        status: 'failed',
        error: {
          code: own ? error.message : ERROR_CODES.IMAGE_HOST_EXPORT_FAILED,
          images: Array.isArray(error.images) ? error.images : [],
        },
      });
    })
    .finally(() => clearInterval(heartbeat));
}

async function findOwnJob({ jobId, user }) {
  const job = await ImageHostExportJobs.findOne({
    jobId: String(jobId),
    userId: userIdOf(user),
  }).lean();
  if (!job) throw new NotFound(ERROR_CODES.IMAGE_HOST_EXPORT_NOT_FOUND);
  return job;
}

/**
 * The status of an export, for the user who started it. A job silent for 20
 * seconds is read as interrupted, and written so.
 * @returns {Promise<{ jobId: string, status: string,
 *   progress: { done: number, total: number },
 *   error: { code: string, images: string[] } | null }>}
 */
async function getImageHostExport({ jobId, user }) {
  const job = await findOwnJob({ jobId, user });
  if (
    job.status === 'hosting' &&
    Date.now() - new Date(job.heartbeatAt).getTime() > SILENCE_MS
  ) {
    const error = {
      code: ERROR_CODES.IMAGE_HOST_EXPORT_INTERRUPTED,
      images: [],
    };
    await ImageHostExportJobs.updateOne(
      { jobId: job.jobId, status: 'hosting' },
      { $set: { status: 'failed', error } }
    );
    Object.assign(job, { status: 'failed', error });
  }
  return {
    jobId: job.jobId,
    status: job.status,
    progress: { done: job.progress.done, total: job.progress.total },
    error: job.error
      ? { code: job.error.code, images: job.error.images || [] }
      : null,
  };
}

/**
 * What the ZIP of a completed export holds.
 * @returns {Promise<{ prefix: string, name: string, html: string }>}
 */
async function getImageHostExportResult({ jobId, user }) {
  const job = await findOwnJob({ jobId, user });
  if (job.status !== 'completed' || !job.result) {
    throw new Conflict(ERROR_CODES.IMAGE_HOST_EXPORT_NOT_COMPLETED);
  }
  const { prefix, name, html } = job.result;
  return { prefix, name, html };
}

module.exports = {
  startImageHostExport,
  getImageHostExport,
  getImageHostExportResult,
};
