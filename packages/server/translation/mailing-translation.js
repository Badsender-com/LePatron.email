'use strict';

const createError = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
const { ProviderError } = require('../integration-providers/provider-error.js');
const logger = require('../utils/logger.js');
const ProviderFactory = require('../integration-providers/provider-factory.js');
const {
  extractTexts,
  getExtractionStats,
} = require('./mosaico-text-extractor.js');
const { validateTranslations } = require('./mosaico-text-injector.js');
const { parseProtectionConfig } = require('./template-protection-parser.js');
const { extractBuilderTexts } = require('./builder-block-texts.js');
const { injectTranslations } = require('./translation-injection.js');
const {
  getTranslationFeature,
  extractFullContext,
} = require('./translation-feature.js');
const {
  splitIntoBatches,
  translateInBatches,
} = require('./translation-batch.utils.js');
const {
  runTranslationStep,
  TRANSLATION_CANCELLED,
} = require('./translation-step.utils.js');

// Translating a whole mailing, for duplicate + translate: extract every text,
// send them in batches, write the translations back. Each phase is a function
// of its own; translation.service.js exposes the entry point.

/**
 * Every text of the mailing to send, keyed for the injectors.
 *
 * Composed blocks need a pass of their own: everything the user wrote is
 * inside `builderState`, one JSON string the generic walker cannot see into.
 * Without this, a mailing with composed blocks came back from translation
 * with those blocks still in the source language, and nothing said so.
 */
async function extractAllTexts(mailing, templateMarkup) {
  // Parse protection config from template markup (if provided)
  const protectionConfig = templateMarkup
    ? await runTranslationStep('parseProtectionConfig', () =>
        parseProtectionConfig(templateMarkup)
      )
    : null;

  return {
    ...(await runTranslationStep('extractTexts', () =>
      extractTexts(mailing, protectionConfig)
    )),
    ...(await runTranslationStep('extractBuilderTexts', () =>
      extractBuilderTexts(mailing.data)
    )),
  };
}

/**
 * Sends the texts to the provider, batch by batch.
 *
 * @returns {Promise<Object>} translations by key
 */
async function translateTexts({
  featureConfig,
  texts,
  totalKeys,
  sourceLanguage,
  targetLanguage,
  onTotalsKnown,
  onBatchProgress,
  assertNotCancelled,
}) {
  // Create provider with feature config (includes model selection)
  const { integration, feature } = featureConfig;
  const provider = ProviderFactory.createProvider(
    integration,
    feature.config || {}
  );

  // Split into batches up-front so the caller can be notified of the totals
  // before any provider call happens (used for live progress reporting).
  const batchLimits = provider.getBatchLimits
    ? provider.getBatchLimits()
    : undefined;
  const batches = await runTranslationStep('splitIntoBatches', () =>
    splitIntoBatches(texts, batchLimits)
  );

  if (onTotalsKnown) {
    await onTotalsKnown({ totalKeys, totalBatches: batches.length });
  }

  // Extract full context for DeepL (improves translation quality)
  // LLM providers will ignore this parameter
  const context = await runTranslationStep('extractFullContext', () =>
    extractFullContext(texts)
  );

  try {
    return await translateInBatches({
      provider,
      batches,
      sourceLanguage,
      targetLanguage,
      context,
      onBatchProgress,
      assertNotCancelled,
    });
  } catch (error) {
    // Passed through as is: wrapped as a provider error, the job was marked
    // failed over its cancelled status.
    if (error.message === TRANSLATION_CANCELLED) throw error;
    logger.error(`[Translation] Translation error: ${error.message}`);
    const status = error instanceof ProviderError ? error.httpStatus : 400;
    throw createError(
      status,
      ERROR_CODES.TRANSLATION_PROVIDER_ERROR + ': ' + error.message
    );
  }
}

/**
 * What the job reports once a mailing is translated.
 */
function statsOf(extraction, validation, injection) {
  return {
    fieldsExtracted: extraction.fieldCount,
    charactersExtracted: extraction.totalCharacters,
    fieldsTranslated: validation.translatedCount,
    fieldsInjected: injection.injected,
    failedInjections: injection.failed,
    composedBlocksRebuilt: injection.builder.blocksUpdated,
    composedBlocksOversized: injection.builder.oversized,
    composedBlocksOutdated: injection.builder.outdated,
  };
}

/**
 * Translate an entire mailing
 * @param {Object} params
 * @param {string} params.groupId - Group ID for integration lookup
 * @param {Object} params.mailing - Mailing document to translate
 * @param {string} params.sourceLanguage - Source language code (or 'auto')
 * @param {string} params.targetLanguage - Target language code
 * @param {string} [params.templateMarkup] - Template HTML markup for protection config
 * @param {Function} [params.onTotalsKnown] - Callback invoked once with ({ totalKeys, totalBatches }) before any provider call
 * @param {Function} [params.onBatchProgress] - Callback for batch progress (batchNumber, keysInBatch)
 * @param {Function} [params.assertNotCancelled] - Throws TRANSLATION_CANCELLED once the job is cancelled
 * @returns {Promise<Object>} Translated mailing data
 */
async function translateMailing(params) {
  const { mailing, onTotalsKnown } = params;
  const featureConfig = await getTranslationFeature(params);

  const textsToTranslate = await extractAllTexts(
    mailing,
    params.templateMarkup
  );
  const stats = getExtractionStats(textsToTranslate);

  if (stats.fieldCount === 0) {
    // Nothing to translate
    if (onTotalsKnown) {
      await onTotalsKnown({ totalKeys: 0, totalBatches: 0 });
    }
    return {
      mailing,
      stats: { fieldsTranslated: 0, charactersTranslated: 0 },
      originalTexts: textsToTranslate,
      translations: {},
    };
  }

  const translations = await translateTexts({
    ...params,
    featureConfig,
    texts: textsToTranslate,
    totalKeys: stats.fieldCount,
  });

  const validation = validateTranslations(textsToTranslate, translations);
  if (!validation.isValid) {
    logger.warn(
      `[Translation] Validation warning - missing: ${validation.missing.length}, extra: ${validation.extra.length}`
    );
    // Continue anyway - partial translation is better than none
  }

  const injection = await injectTranslations(mailing, translations);

  return {
    mailing: injection.mailing,
    stats: statsOf(stats, validation, injection),
    originalTexts: textsToTranslate,
    translations,
  };
}

module.exports = { translateMailing };
