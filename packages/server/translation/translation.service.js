'use strict';

const { BadRequest } = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
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
const {
  parseProtectionConfig,
} = require('./template-protection-parser.js');
const {
  splitIntoBatches,
  translateInBatches,
} = require('./translation-batch.utils.js');

module.exports = {
  translateMailing,
  translateText,
  getAvailableLanguages,
  detectSourceLanguage,
  getBatchInfo,
};

/**
 * Get batch info for a mailing (used for progress tracking)
 * @param {Object} params
 * @param {Object} params.mailing - Mailing document
 * @param {string} [params.templateMarkup] - Template HTML markup for protection config
 * @returns {Promise<Object>} Batch info { totalKeys, totalBatches }
 */
// eslint-disable-next-line no-unused-vars
async function getBatchInfo({ mailing, templateMarkup }) {
  // Parse protection config from template markup (if provided)
  const protectionConfig = templateMarkup
    ? parseProtectionConfig(templateMarkup)
    : null;

  // Extract texts from mailing (respecting protection config)
  const textsToTranslate = extractTexts(mailing, protectionConfig);
  const totalKeys = Object.keys(textsToTranslate).length;

  if (totalKeys === 0) {
    return { totalKeys: 0, totalBatches: 0 };
  }

  const batches = splitIntoBatches(textsToTranslate);
  return {
    totalKeys,
    totalBatches: batches.length,
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
 * @param {Function} [params.onBatchProgress] - Callback for batch progress (batchNumber, keysInBatch)
 * @returns {Promise<Object>} Translated mailing data
 */
async function translateMailing({
  groupId,
  mailing,
  sourceLanguage,
  targetLanguage,
  templateMarkup,
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
    return {
      mailing,
      stats: {
        fieldsTranslated: 0,
        charactersTranslated: 0,
      },
    };
  }

  // Create provider with feature config (includes model selection)
  const providerFeatureConfig = feature.config || {};
  const provider = ProviderFactory.createProvider(
    integration,
    providerFeatureConfig
  );

  let translations;
  try {
    translations = await translateInBatches({
      provider,
      texts: textsToTranslate,
      sourceLanguage,
      targetLanguage,
      onBatchProgress,
    });
  } catch (error) {
    logger.error(`[Translation] Translation error: ${error.message}`);
    throw new BadRequest(
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

  // Note: previewHtml will be regenerated via Puppeteer after the mailing is saved
  // This is done in translation.controller.js to ensure data is persisted first

  return {
    mailing: translatedMailing,
    stats: {
      fieldsExtracted: stats.fieldCount,
      charactersExtracted: stats.totalCharacters,
      fieldsTranslated: validation.translatedCount,
      fieldsInjected: injectionStats.injected,
      failedInjections: injectionStats.failed,
    },
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
    throw new BadRequest(
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
