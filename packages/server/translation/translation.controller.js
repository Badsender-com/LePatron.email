'use strict';

const asyncHandler = require('express-async-handler');
const translationService = require('./translation.service');
const mailingService = require('../mailing/mailing.service');
const previewGenerator = require('../mailing/preview-generator.service');
const translationJobs = require('./translation-jobs');
const { Mailings } = require('../common/models.common');

module.exports = {
  duplicateAndTranslate: asyncHandler(duplicateAndTranslate),
  getJobStatus: asyncHandler(getJobStatus),
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

  // Get original mailing
  const originalMailing = await mailingService.findOne(mailingId);

  // Get user's group
  const groupId =
    (user.group && user.group.id) ||
    (originalMailing._company && originalMailing._company.toString());

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
  });

  // Create a job for progress tracking
  const job = translationJobs.createJob({
    totalKeys: batchInfo.totalKeys,
    totalBatches: batchInfo.totalBatches,
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
  cookies,
}) {
  try {
    // Progress callback to update job status
    const onBatchProgress = (batchNumber, keysInBatch) => {
      translationJobs.updateBatchProgress(jobId, batchNumber, keysInBatch);
    };

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
      console.log(
        `[Translation] Regenerating preview for mailing ${duplicatedMailing._id}...`
      );
      const previewHtml = await previewGenerator.generatePreviewHtml({
        mailingId: duplicatedMailing._id.toString(),
        cookies,
      });

      // Save the new previewHtml
      await Mailings.findByIdAndUpdate(duplicatedMailing._id, { previewHtml });
      previewGenerated = true;
      console.log('[Translation] Preview regenerated successfully');
    } catch (error) {
      // Don't fail the translation if preview generation fails
      console.error(
        `[Translation] Preview generation failed: ${error.message}`
      );
    }

    // Mark job as completed
    translationJobs.setCompleted(jobId, {
      mailingId: duplicatedMailing._id.toString(),
      mailingName: duplicatedMailing.name,
      previewGenerated,
      stats,
      sourceLanguage,
      targetLanguage,
      warnings: [
        'Vérifiez les liens présents dans l\'email',
        'Vérifiez les images contenant du texte',
        'Vérifiez la variante de template si applicable',
      ],
    });
  } catch (error) {
    console.error(`[Translation] Job ${jobId} failed:`, error.message);
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
  const { jobId } = req.params;

  const job = translationJobs.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(job);
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
