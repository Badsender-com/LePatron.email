'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const translationService = require('./translation.service');
const translationJobs = require('./translation-jobs');
const { processTranslationAsync } = require('./translation-job-runner.js');
const logger = require('../utils/logger.js');
const ERROR_CODES = require('../constant/error-codes.js');

// /translation/block, /translation/text and /mailings/:id/duplicate-translate
// forward user payloads to an external provider: their routes go through
// aiRateLimit (ai-usage/ai-rate-limit.js), which caps the payload size and
// counts each request against per-user and per-group windows.

module.exports = {
  duplicateAndTranslate: asyncHandler(duplicateAndTranslate),
  getJobStatus: asyncHandler(getJobStatus),
  cancelJob: asyncHandler(cancelJob),
  translateText: asyncHandler(translateText),
  translateBlock: asyncHandler(translateBlock),
  getLanguages: asyncHandler(getLanguages),
};

/**
 * @api {post} /mailings/:mailingId/duplicate-translate Duplicate and translate a mailing
 * @apiPermission user
 * @apiName DuplicateAndTranslate
 * @apiGroup Translation
 *
 * @apiParam {String} mailingId Mailing ID to duplicate and translate
 * @apiParam (Body) {String} targetLanguage Target language code
 * @apiParam (Body) {String} [sourceLanguage='auto'] Source language code
 * @apiParam (Body) {String} [newName] Name for the translated copy
 *
 * @apiSuccess {String} jobId Job ID to poll for progress
 */
async function duplicateAndTranslate(req, res) {
  const { user, params, body } = req;
  const { mailingId } = params;
  const {
    targetLanguage,
    sourceLanguage = 'auto',
    newName,
    workspaceId,
    folderId,
  } = body;

  // Validate required parameters
  if (!targetLanguage || typeof targetLanguage !== 'string') {
    throw createError(400, ERROR_CODES.TRANSLATION_TARGET_LANGUAGE_REQUIRED);
  }

  // Create the job up-front so the client can start polling immediately.
  // Heavy work (DB lookups, text extraction, batching) is moved to the
  // background task below to keep this handler from blocking the event loop.
  const job = await translationJobs.createJob({
    userId: user.id || user._id.toString(),
  });

  // Return jobId immediately
  res.status(202).json({ jobId: job.jobId });

  // Process translation asynchronously (fire-and-forget after the 202 response)
  processTranslationAsync({
    jobId: job.jobId,
    mailingId,
    user,
    sourceLanguage,
    targetLanguage,
    newName,
    workspaceId,
    folderId,
  }).catch((error) => {
    logger.error(
      `[Translation] Unhandled error in background job ${job.jobId}: ${error.message}`
    );
  });
}

/**
 * Get a job by ID or throw 404/403
 */
async function getJobOrThrow(jobId, user) {
  const job = await translationJobs.getJob(jobId);
  if (!job) {
    throw createError(404, ERROR_CODES.TRANSLATION_JOB_NOT_FOUND);
  }
  const userId = user.id || user._id.toString();
  if (job.userId !== userId) {
    throw createError(403, ERROR_CODES.TRANSLATION_JOB_ACCESS_DENIED);
  }
  return job;
}

/**
 * @api {get} /translation/jobs/:jobId/status Get translation job status
 * @apiPermission user
 * @apiName GetJobStatus
 * @apiGroup Translation
 *
 * @apiParam {String} jobId Job ID
 */
async function getJobStatus(req, res) {
  const job = await getJobOrThrow(req.params.jobId, req.user);
  res.json(job);
}

/**
 * @api {post} /translation/jobs/:jobId/cancel Cancel a translation job
 * @apiPermission user
 * @apiName CancelJob
 * @apiGroup Translation
 *
 * @apiParam {String} jobId Job ID
 */
async function cancelJob(req, res) {
  await getJobOrThrow(req.params.jobId, req.user);
  const cancelled = await translationJobs.cancelJob(req.params.jobId);

  if (!cancelled) {
    throw createError(400, ERROR_CODES.TRANSLATION_JOB_CANCEL_FAILED);
  }

  res.json({ success: true, message: 'Job cancelled' });
}

/**
 * @api {post} /translation/text Translate a single text
 * @apiPermission user
 * @apiName TranslateText
 * @apiGroup Translation
 *
 * @apiParam (Body) {String} text Text to translate
 * @apiParam (Body) {String} targetLanguage Target language code
 * @apiParam (Body) {String} [sourceLanguage='auto'] Source language code
 */
async function translateText(req, res) {
  const { user, body } = req;
  const { text, targetLanguage, sourceLanguage = 'auto' } = body;

  const groupId = user.group && user.group.id;

  const translatedText = await translationService.translateText({
    groupId,
    text,
    sourceLanguage,
    targetLanguage,
  });

  res.json({
    original: text,
    translated: translatedText,
    sourceLanguage,
    targetLanguage,
  });
}

/**
 * @api {post} /translation/block Translate a single block
 * @apiPermission user
 * @apiName TranslateBlock
 * @apiGroup Translation
 *
 * @apiParam (Body) {Object} blockContent Block content to translate (flat object with text fields)
 * @apiParam (Body) {String} targetLanguage Target language code
 * @apiParam (Body) {String} [sourceLanguage='auto'] Source language code
 */
async function translateBlock(req, res) {
  const { user, body } = req;
  const { blockContent, targetLanguage, sourceLanguage = 'auto' } = body;

  // Validate inputs
  if (!blockContent || typeof blockContent !== 'object') {
    throw createError(400, ERROR_CODES.TRANSLATION_INVALID_BLOCK_CONTENT);
  }

  const groupId = user.group && user.group.id;

  const translatedBlock = await translationService.translateBlockContent({
    groupId,
    blockContent,
    sourceLanguage,
    targetLanguage,
  });

  res.json({
    original: blockContent,
    translated: translatedBlock,
    sourceLanguage,
    targetLanguage,
  });
}

/**
 * @api {get} /translation/languages Get available languages for user's group
 * @apiPermission user
 * @apiName GetTranslationLanguages
 * @apiGroup Translation
 */
async function getLanguages(req, res) {
  const { user } = req;
  const groupId = user.group && user.group.id;

  const languageConfig = await translationService.getAvailableLanguages({
    groupId,
  });

  res.json(languageConfig);
}
