'use strict';

const translationService = require('./translation.service');
const mailingService = require('../mailing/mailing.service');
const { storeTranslatedPreview } = require('./translation-preview.js');
const translationJobs = require('./translation-jobs');
const {
  runTranslationStep,
  TRANSLATION_CANCELLED,
} = require('./translation-step.utils.js');
const logger = require('../utils/logger.js');
const { Templates } = require('../common/models.common');
const { warningKeysFor } = require('./translation-warnings.js');

// The background half of duplicate + translate: everything that runs after
// the controller has answered 202 with a job id. Its own module so the
// controller stays the HTTP surface, and each phase here a function of its
// own — load, translate, duplicate, preview, complete.

/**
 * The job's progress and cancellation callbacks, as translateMailing takes
 * them.
 */
function jobCallbacks(jobId) {
  const assertNotCancelled = async () => {
    if (await translationJobs.isCancelled(jobId)) {
      throw new Error(TRANSLATION_CANCELLED);
    }
  };

  return {
    assertNotCancelled,
    onTotalsKnown: ({ totalKeys, totalBatches }) =>
      translationJobs.setTotals(jobId, { totalKeys, totalBatches }),
    // Checks for cancellation before processing the next batch.
    onBatchProgress: async (batchNumber, keysInBatch) => {
      await assertNotCancelled();
      await translationJobs.updateBatchProgress(
        jobId,
        batchNumber,
        keysInBatch
      );
    },
  };
}

/**
 * The source mailing, its group, its template's markup and builder flag.
 *
 * Group-scoped load: the source mailing must belong to the caller's group (or
 * caller is super admin). Without this filter a group admin could
 * translate+duplicate a mailing of another group by id (cross-tenant IDOR).
 */
async function loadSource({ mailingId, user }) {
  const mailing = await runTranslationStep('loadMailing', () =>
    mailingService.findOneForUser(mailingId, user)
  );

  const groupId =
    (user.group && user.group.id) ||
    (mailing._company && mailing._company.toString());

  let templateMarkup = null;
  let blockBuilderEnabled = false;
  if (mailing._wireframe) {
    const template = await runTranslationStep('loadTemplate', () =>
      Templates.findById(mailing._wireframe, {
        markup: 1,
        blockBuilderEnabled: 1,
      })
    );
    templateMarkup = template?.markup || null;
    blockBuilderEnabled = Boolean(template && template.blockBuilderEnabled);
  }

  return { mailing, groupId, templateMarkup, blockBuilderEnabled };
}

/**
 * Translates the source mailing: everything up to, but not including, the
 * copy.
 */
async function translateSource({
  jobId,
  source,
  sourceLanguage,
  targetLanguage,
}) {
  const { mailing, groupId, templateMarkup, blockBuilderEnabled } = source;
  const detectedSourceLanguage =
    sourceLanguage === 'auto'
      ? await runTranslationStep('detectSourceLanguage', () =>
          translationService.detectSourceLanguage(mailing)
        )
      : sourceLanguage;

  const result = await translationService.translateMailing({
    groupId,
    mailing: {
      name: mailing.name,
      data: mailing.data,
      previewHtml: mailing.previewHtml,
    },
    sourceLanguage: detectedSourceLanguage,
    targetLanguage,
    templateMarkup,
    blockBuilderEnabled,
    ...jobCallbacks(jobId),
  });

  return { ...result, sourceLanguage: detectedSourceLanguage };
}

/**
 * Process translation asynchronously (runs in background after response)
 *
 * Heavy work that used to run synchronously inside the HTTP handler is done
 * here so the 202 response can be sent without blocking the event loop.
 */
async function processTranslationAsync(params) {
  const { jobId, mailingId, user, targetLanguage, newName } = params;
  try {
    if (await translationJobs.isCancelled(jobId)) {
      logger.log(`[Translation] Job ${jobId} cancelled before starting`);
      return;
    }

    const source = await loadSource({ mailingId, user });
    const translated = await translateSource({ ...params, source });
    const { mailing: translatedData, stats } = translated;

    const duplicatedMailing = await mailingService.duplicateWithTranslatedData({
      mailingId,
      user,
      newName:
        newName || `${translatedData.name} - ${targetLanguage.toUpperCase()}`,
      translatedData: translatedData.data,
      workspaceId: params.workspaceId,
      folderId: params.folderId,
    });

    const preview = await storeTranslatedPreview({
      copyId: duplicatedMailing._id,
      source: source.mailing,
      translatedData: translatedData.data,
      originalTexts: translated.originalTexts,
      translations: translated.translations,
    });

    await translationJobs.setCompleted(jobId, {
      mailingId: duplicatedMailing._id.toString(),
      mailingName: duplicatedMailing.name,
      previewGenerated: preview.previewGenerated,
      stats,
      sourceLanguage: translated.sourceLanguage,
      targetLanguage,
      warningKeys: warningKeysFor(stats, preview.missedComposedBlocks),
    });
  } catch (error) {
    // Handle cancellation gracefully
    if (error.message === TRANSLATION_CANCELLED) {
      logger.log(`[Translation] Job ${jobId} was cancelled by user`);
      return;
    }

    logger.error(`[Translation] Job ${jobId} failed: ${error.message}`);
    await translationJobs.setFailed(jobId, error.message);
  }
}

module.exports = { processTranslationAsync };
