'use strict';

const { BadRequest } = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
const AIFeatureTypes = require('../constant/ai-feature-type.js');
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

// Maximum number of keys per batch to avoid API timeouts
// Set high values to keep full email context - adjust if timeouts occur
const MAX_KEYS_PER_BATCH = 100;
// Maximum characters per batch (gpt-4o supports 128k tokens)
const MAX_CHARS_PER_BATCH = 50000;

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
 * @returns {Promise<Object>} Batch info { totalKeys, totalBatches }
 */
// eslint-disable-next-line no-unused-vars
async function getBatchInfo({ mailing }) {
  // Extract texts from mailing
  const textsToTranslate = extractTexts(mailing);
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
 * @param {Function} [params.onBatchProgress] - Callback for batch progress (batchNumber, keysInBatch)
 * @returns {Promise<Object>} Translated mailing data
 */
async function translateMailing({
  groupId,
  mailing,
  sourceLanguage,
  targetLanguage,
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
    throw new BadRequest(
      `Target language '${targetLanguage}' is not configured for this group`
    );
  }

  // Extract texts from mailing
  const textsToTranslate = extractTexts(mailing);
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
    console.error('Translation error:', error.message);
    throw new BadRequest(
      ERROR_CODES.TRANSLATION_PROVIDER_ERROR + ': ' + error.message
    );
  }

  // Validate translations
  const validation = validateTranslations(textsToTranslate, translations);
  if (!validation.isValid) {
    console.warn('Translation validation warning:', {
      missing: validation.missing,
      extra: validation.extra,
    });
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
    throw new BadRequest(
      `Target language '${targetLanguage}' is not configured for this group`
    );
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
    console.error('Translation error:', error.message);
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

/**
 * Split texts into batches for translation
 * @param {Object} texts - Object with key-value pairs to translate
 * @returns {Array<Object>} Array of batch objects
 */
function splitIntoBatches(texts) {
  const batches = [];
  let currentBatch = {};
  let currentBatchChars = 0;
  let currentBatchKeys = 0;

  const entries = Object.entries(texts);

  for (const [key, value] of entries) {
    const valueLength = (value || '').length;

    // Check if adding this entry would exceed limits
    const wouldExceedKeys = currentBatchKeys >= MAX_KEYS_PER_BATCH;
    const wouldExceedChars =
      currentBatchChars + valueLength > MAX_CHARS_PER_BATCH;

    // Start new batch if limits exceeded (and current batch is not empty)
    if ((wouldExceedKeys || wouldExceedChars) && currentBatchKeys > 0) {
      batches.push(currentBatch);
      currentBatch = {};
      currentBatchChars = 0;
      currentBatchKeys = 0;
    }

    currentBatch[key] = value;
    currentBatchChars += valueLength;
    currentBatchKeys++;
  }

  // Don't forget the last batch
  if (currentBatchKeys > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Translate texts in batches to avoid API timeouts
 * @param {Object} params
 * @param {Object} params.provider - AI provider instance
 * @param {Object} params.texts - Texts to translate
 * @param {string} params.sourceLanguage - Source language
 * @param {string} params.targetLanguage - Target language
 * @param {Function} [params.onBatchProgress] - Callback for batch progress (batchNumber, keysInBatch)
 * @returns {Promise<Object>} Merged translations
 */
async function translateInBatches({
  provider,
  texts,
  sourceLanguage,
  targetLanguage,
  onBatchProgress,
}) {
  const batches = splitIntoBatches(texts);

  console.log(
    `Translating ${Object.keys(texts).length} keys in ${
      batches.length
    } batch(es)`
  );

  // Translate batches sequentially to avoid rate limiting
  const results = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchSize = Object.keys(batch).length;
    console.log(
      `Processing batch ${i + 1}/${batches.length} (${batchSize} keys)`
    );

    const batchResult = await provider.translateBatch({
      texts: batch,
      sourceLanguage,
      targetLanguage,
    });

    results.push(batchResult);

    // Call progress callback if provided
    if (onBatchProgress) {
      onBatchProgress(i + 1, batchSize);
    }
  }

  // Merge all batch results into one object
  const mergedTranslations = {};
  for (const result of results) {
    Object.assign(mergedTranslations, result);
  }

  console.log(
    `Translation complete: ${
      Object.keys(mergedTranslations).length
    } keys translated`
  );

  return mergedTranslations;
}
