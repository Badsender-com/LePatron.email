'use strict';

const logger = require('../utils/logger.js');

const DEFAULT_BATCH_LIMITS = { maxKeys: 100, maxChars: 50000 };

module.exports = {
  splitIntoBatches,
  translateInBatches,
  DEFAULT_BATCH_LIMITS,
};

/**
 * Split texts into batches for translation
 * @param {Object} texts - Object with key-value pairs to translate
 * @param {{ maxKeys: number, maxChars: number }} [batchLimits] - Batch limits
 * @returns {Array<Object>} Array of batch objects
 */
function splitIntoBatches(texts, batchLimits) {
  const { maxKeys, maxChars } = batchLimits || DEFAULT_BATCH_LIMITS;
  const batches = [];
  let currentBatch = {};
  let currentBatchChars = 0;
  let currentBatchKeys = 0;

  const entries = Object.entries(texts);

  for (const [key, value] of entries) {
    const valueLength = (value || '').length;

    // Check if adding this entry would exceed limits
    const wouldExceedKeys = currentBatchKeys >= maxKeys;
    const wouldExceedChars = currentBatchChars + valueLength > maxChars;

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
 * @param {string} [params.context] - Additional context for translation (used by DeepL)
 * @param {Function} [params.onBatchProgress] - Callback for batch progress (batchNumber, keysInBatch)
 * @returns {Promise<Object>} Merged translations
 */
async function translateInBatches({
  provider,
  texts,
  sourceLanguage,
  targetLanguage,
  context,
  onBatchProgress,
}) {
  const batchLimits = provider.getBatchLimits
    ? provider.getBatchLimits()
    : DEFAULT_BATCH_LIMITS;
  const batches = splitIntoBatches(texts, batchLimits);

  logger.log(
    `[Translation] Translating ${Object.keys(texts).length} keys in ${
      batches.length
    } batch(es)`
  );

  // Translate batches sequentially to avoid rate limiting
  const results = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchSize = Object.keys(batch).length;
    logger.log(
      `[Translation] Processing batch ${i + 1}/${
        batches.length
      } (${batchSize} keys)`
    );

    const batchResult = await provider.translateBatch({
      texts: batch,
      sourceLanguage,
      targetLanguage,
      context, // Passed to provider (DeepL uses this, LLM providers ignore it)
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

  logger.log(
    `[Translation] Translation complete: ${
      Object.keys(mergedTranslations).length
    } keys translated`
  );

  return mergedTranslations;
}
