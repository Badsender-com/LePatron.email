'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const translationService = require('./translation.service');
const mailingService = require('../mailing/mailing.service');
const previewGenerator = require('../mailing/preview-generator.service');
const translationJobs = require('./translation-jobs');
const logger = require('../utils/logger.js');
const { Mailings, Templates } = require('../common/models.common');
const { ERROR_CODES } = require('../constant/error-codes.js');

module.exports = {
  duplicateAndTranslate: asyncHandler(duplicateAndTranslate),
  getJobStatus: asyncHandler(getJobStatus),
  cancelJob: asyncHandler(cancelJob),
  translateText: asyncHandler(translateText),
  getLanguages: asyncHandler(getLanguages),
  detectLanguage: asyncHandler(detectLanguage),
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
  const { targetLanguage, sourceLanguage = 'auto', newName } = body;

  // Validate required parameters
  if (!targetLanguage || typeof targetLanguage !== 'string') {
    throw createError(400, ERROR_CODES.TRANSLATION_TARGET_LANGUAGE_REQUIRED);
  }

  // Get original mailing
  const originalMailing = await mailingService.findOne(mailingId);

  // Get user's group
  const groupId =
    (user.group && user.group.id) ||
    (originalMailing._company && originalMailing._company.toString());

  // Get template markup for translation protection config
  let templateMarkup = null;
  if (originalMailing._wireframe) {
    const template = await Templates.findById(originalMailing._wireframe, {
      markup: 1,
    });
    templateMarkup = template?.markup || null;
  }

  // Detect source language if not provided
  const detectedSourceLanguage =
    sourceLanguage === 'auto'
      ? translationService.detectSourceLanguage(originalMailing)
      : sourceLanguage;

  // Get batch info for progress tracking
  const batchInfo = await translationService.getBatchInfo({
    groupId,
    mailing: {
      name: originalMailing.name,
      data: originalMailing.data,
      previewHtml: originalMailing.previewHtml,
    },
    templateMarkup,
  });

  // Create a job for progress tracking (include userId for authorization)
  const job = translationJobs.createJob({
    totalKeys: batchInfo.totalKeys,
    totalBatches: batchInfo.totalBatches,
    userId: user.id || user._id.toString(),
  });

  // Return jobId immediately
  res.status(202).json({ jobId: job.jobId });

  // Process translation asynchronously
  processTranslationAsync({
    jobId: job.jobId,
    originalMailing,
    mailingId,
    user,
    groupId,
    sourceLanguage: detectedSourceLanguage,
    targetLanguage,
    newName,
    templateMarkup,
    cookies: req.cookies,
  });
}

/**
 * Process translation asynchronously (runs in background after response)
 */
async function processTranslationAsync({
  jobId,
  originalMailing,
  mailingId,
  user,
  groupId,
  sourceLanguage,
  targetLanguage,
  newName,
  templateMarkup,
  cookies,
}) {
  try {
    // Progress callback to update job status and check for cancellation
    const onBatchProgress = (batchNumber, keysInBatch) => {
      // Check if job was cancelled before processing next batch
      if (translationJobs.isCancelled(jobId)) {
        throw new Error('TRANSLATION_CANCELLED');
      }
      translationJobs.updateBatchProgress(jobId, batchNumber, keysInBatch);
    };

    // Check cancellation before starting
    if (translationJobs.isCancelled(jobId)) {
      logger.log(`[Translation] Job ${jobId} cancelled before starting`);
      return;
    }

    // Translate the mailing
    const {
      mailing: translatedData,
      stats,
    } = await translationService.translateMailing({
      groupId,
      mailing: {
        name: originalMailing.name,
        data: originalMailing.data,
        previewHtml: originalMailing.previewHtml,
      },
      sourceLanguage,
      targetLanguage,
      templateMarkup,
      onBatchProgress,
    });

    // Generate new name
    const translatedName =
      newName || `${translatedData.name} - ${targetLanguage.toUpperCase()}`;

    // Duplicate the mailing with translated content
    const duplicatedMailing = await mailingService.duplicateWithTranslatedData({
      mailingId,
      user,
      newName: translatedName,
      translatedData: translatedData.data,
    });

    // Update job status to generating preview
    translationJobs.setGeneratingPreview(jobId);

    // Regenerate previewHtml via Puppeteer
    let previewGenerated = false;
    try {
      logger.log(
        `[Translation] Regenerating preview for mailing ${duplicatedMailing._id}...`
      );
      const previewHtml = await previewGenerator.generatePreviewHtml({
        mailingId: duplicatedMailing._id.toString(),
        cookies,
      });

      // Save the new previewHtml
      await Mailings.findByIdAndUpdate(duplicatedMailing._id, { previewHtml });
      previewGenerated = true;
      logger.log('[Translation] Preview regenerated successfully');
    } catch (error) {
      // Don't fail the translation if preview generation fails
      logger.error(
        `[Translation] Preview generation failed: ${error.message}`
      );
    }

    // Mark job as completed
    // Warning keys are translated by the frontend
    translationJobs.setCompleted(jobId, {
      mailingId: duplicatedMailing._id.toString(),
      mailingName: duplicatedMailing.name,
      previewGenerated,
      stats,
      sourceLanguage,
      targetLanguage,
      warningKeys: [
        'translation.warnings.checkLinks',
        'translation.warnings.checkImages',
        'translation.warnings.checkVariant',
      ],
    });
  } catch (error) {
    // Handle cancellation gracefully
    if (error.message === 'TRANSLATION_CANCELLED') {
      logger.log(`[Translation] Job ${jobId} was cancelled by user`);
      return;
    }

    logger.error(`[Translation] Job ${jobId} failed: ${error.message}`);
    translationJobs.setFailed(jobId, error.message);
  }
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
  const { user } = req;
  const { jobId } = req.params;

  const job = translationJobs.getJob(jobId);

  if (!job) {
    throw createError(404, ERROR_CODES.TRANSLATION_JOB_NOT_FOUND);
  }

  // Authorization check: user must own the job
  const userId = user.id || user._id.toString();
  if (job.userId !== userId) {
    throw createError(403, ERROR_CODES.TRANSLATION_JOB_ACCESS_DENIED);
  }

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
  const { user } = req;
  const { jobId } = req.params;

  const job = translationJobs.getJob(jobId);

  if (!job) {
    throw createError(404, ERROR_CODES.TRANSLATION_JOB_NOT_FOUND);
  }

  // Authorization check: user must own the job
  const userId = user.id || user._id.toString();
  if (job.userId !== userId) {
    throw createError(403, ERROR_CODES.TRANSLATION_JOB_ACCESS_DENIED);
  }

  const cancelled = translationJobs.cancelJob(jobId);

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

/**
 * @api {get} /translation/detect-language/:mailingId Detect source language of a mailing
 * @apiPermission user
 * @apiName DetectLanguage
 * @apiGroup Translation
 *
 * @apiParam {String} mailingId Mailing ID
 */
async function detectLanguage(req, res) {
  const { params } = req;
  const { mailingId } = params;

  const mailing = await mailingService.findOne(mailingId);
  const detectedLanguage = translationService.detectSourceLanguage(mailing);

  res.json({
    mailingId,
    detectedLanguage,
    isAutoDetected: detectedLanguage === 'auto',
  });
}
