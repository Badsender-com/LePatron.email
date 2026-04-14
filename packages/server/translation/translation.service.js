'use strict';

const createError = require('http-errors');
const { BadRequest } = createError;
const ERROR_CODES = require('../constant/error-codes.js');
const { ProviderError } = require('../integration-providers/provider-error.js');
const AIFeatureTypes = require('../constant/ai-feature-type.js');
const logger = require('../utils/logger.js');
const aiFeatureService = require('../ai-feature/ai-feature.service.js');
const ProviderFactory = require('../integration-providers/provider-factory.js');
const {
  extractTexts,
  getExtractionStats,
} = require('./mosaico-text-extractor.js');
const {
  injectTexts,
  validateTranslations,
} = require('./mosaico-text-injector.js');
const { parseProtectionConfig } = require('./template-protection-parser.js');
const {
  splitIntoBatches,
  translateInBatches,
} = require('./translation-batch.utils.js');

module.exports = {
  translateMailing,
  translateText,
  getAvailableLanguages,
  detectSourceLanguage,
  extractFullContext,
};

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
 * @returns {Promise<Object>} Translated mailing data
 */
async function translateMailing({
  groupId,
  mailing,
  sourceLanguage,
  targetLanguage,
  templateMarkup,
  onTotalsKnown,
  onBatchProgress,
}) {
  // Get active translation feature with integration
  const featureConfig = await aiFeatureService.getActiveFeatureWithIntegration({
    groupId,
    featureType: AIFeatureTypes.TRANSLATION,
  });

  if (!featureConfig) {
    throw new BadRequest(ERROR_CODES.NO_INTEGRATION_FOR_FEATURE);
  }

  const { integration, feature } = featureConfig;

  // Validate target language is allowed
  const availableLanguages = feature.config?.availableLanguages || [];
  if (
    availableLanguages.length > 0 &&
    !availableLanguages.includes(targetLanguage)
  ) {
    throw new BadRequest(ERROR_CODES.TRANSLATION_TARGET_LANGUAGE_NOT_ALLOWED);
  }

  // Parse protection config from template markup (if provided)
  const protectionConfig = templateMarkup
    ? parseProtectionConfig(templateMarkup)
    : null;

  // Extract texts from mailing (respecting protection config)
  const textsToTranslate = extractTexts(mailing, protectionConfig);
  const stats = getExtractionStats(textsToTranslate);

  if (stats.fieldCount === 0) {
    // Nothing to translate
    if (onTotalsKnown) {
      await onTotalsKnown({ totalKeys: 0, totalBatches: 0 });
    }
    return {
      mailing,
      stats: {
        fieldsTranslated: 0,
        charactersTranslated: 0,
      },
      originalTexts: textsToTranslate,
      translations: {},
    };
  }

  // Create provider with feature config (includes model selection)
  const providerFeatureConfig = feature.config || {};
  const provider = ProviderFactory.createProvider(
    integration,
    providerFeatureConfig
  );

  // Split into batches up-front so the caller can be notified of the totals
  // before any provider call happens (used for live progress reporting).
  const batchLimits = provider.getBatchLimits
    ? provider.getBatchLimits()
    : undefined;
  const batches = splitIntoBatches(textsToTranslate, batchLimits);

  if (onTotalsKnown) {
    await onTotalsKnown({
      totalKeys: stats.fieldCount,
      totalBatches: batches.length,
    });
  }

  // Extract full context for DeepL (improves translation quality)
  // LLM providers will ignore this parameter
  const context = extractFullContext(textsToTranslate);

  let translations;
  try {
    translations = await translateInBatches({
      provider,
      batches,
      sourceLanguage,
      targetLanguage,
      context,
      onBatchProgress,
    });
  } catch (error) {
    logger.error(`[Translation] Translation error: ${error.message}`);
    const status = error instanceof ProviderError ? error.httpStatus : 400;
    throw createError(
      status,
      ERROR_CODES.TRANSLATION_PROVIDER_ERROR + ': ' + error.message
    );
  }

  // Validate translations
  const validation = validateTranslations(textsToTranslate, translations);
  if (!validation.isValid) {
    logger.warn(
      `[Translation] Validation warning - missing: ${validation.missing.length}, extra: ${validation.extra.length}`
    );
    // Continue anyway - partial translation is better than none
  }

  // Inject translations back into mailing
  const { mailing: translatedMailing, stats: injectionStats } = injectTexts(
    mailing,
    translations
  );

  return {
    mailing: translatedMailing,
    stats: {
      fieldsExtracted: stats.fieldCount,
      charactersExtracted: stats.totalCharacters,
      fieldsTranslated: validation.translatedCount,
      fieldsInjected: injectionStats.injected,
      failedInjections: injectionStats.failed,
    },
    originalTexts: textsToTranslate,
    translations,
  };
}

/**
 * Translate a single text (for inline/field-by-field translation)
 * @param {Object} params
 * @param {string} params.groupId - Group ID
 * @param {string} params.text - Text to translate
 * @param {string} params.sourceLanguage - Source language code (or 'auto')
 * @param {string} params.targetLanguage - Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateText({
  groupId,
  text,
  sourceLanguage,
  targetLanguage,
}) {
  // Get active translation feature with integration
  const featureConfig = await aiFeatureService.getActiveFeatureWithIntegration({
    groupId,
    featureType: AIFeatureTypes.TRANSLATION,
  });

  if (!featureConfig) {
    throw new BadRequest(ERROR_CODES.NO_INTEGRATION_FOR_FEATURE);
  }

  const { integration, feature } = featureConfig;

  // Validate target language is allowed
  const availableLanguages = feature.config?.availableLanguages || [];
  if (
    availableLanguages.length > 0 &&
    !availableLanguages.includes(targetLanguage)
  ) {
    throw new BadRequest(ERROR_CODES.TRANSLATION_TARGET_LANGUAGE_NOT_ALLOWED);
  }

  // Create provider with feature config (includes model selection)
  const providerConfig = feature.config || {};
  const provider = ProviderFactory.createProvider(integration, providerConfig);

  try {
    return await provider.translateText({
      text,
      sourceLanguage,
      targetLanguage,
    });
  } catch (error) {
    logger.error(`[Translation] Translation error: ${error.message}`);
    const status = error instanceof ProviderError ? error.httpStatus : 400;
    throw createError(
      status,
      ERROR_CODES.TRANSLATION_PROVIDER_ERROR + ': ' + error.message
    );
  }
}

/**
 * Get available languages for a group
 * @param {string} groupId - Group ID
 * @returns {Promise<Object>} Available languages configuration
 */
async function getAvailableLanguages({ groupId }) {
  const featureConfig = await aiFeatureService.getActiveFeatureWithIntegration({
    groupId,
    featureType: AIFeatureTypes.TRANSLATION,
  });

  if (!featureConfig) {
    return {
      isAvailable: false,
      languages: [],
      defaultSourceLanguage: 'auto',
    };
  }

  const { feature } = featureConfig;

  return {
    isAvailable: true,
    languages: feature.config?.availableLanguages || [],
    defaultSourceLanguage: feature.config?.defaultSourceLanguage || 'auto',
  };
}

/**
 * Detect source language from mailing HTML preview
 * @param {Object} mailing - Mailing document
 * @returns {string} Detected language code or 'auto'
 */
function detectSourceLanguage(mailing) {
  // Try to extract lang attribute from previewHtml
  if (mailing.previewHtml) {
    const langMatch = mailing.previewHtml.match(
      /<html[^>]*\slang=["']([a-z]{2})["']/i
    );
    if (langMatch) {
      return langMatch[1].toLowerCase();
    }
  }

  // Fallback to auto-detect
  return 'auto';
}

/**
 * Extract full context from mailing for translation
 * Used by DeepL to provide context for better translations
 * @param {Object} textsToTranslate - Extracted texts object
 * @returns {string} Concatenated context text
 */
function extractFullContext(textsToTranslate) {
  if (!textsToTranslate || typeof textsToTranslate !== 'object') {
    return '';
  }

  // Get all text values and join them
  const allTexts = Object.values(textsToTranslate)
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim());

  // Join with double newlines for clear separation
  return allTexts.join('\n\n');
}
