'use strict';

const logger = require('../utils/logger.js');
const {
  PROVIDER_ERROR_CODES: CODES,
} = require('../integration-providers/provider-error.js');

const DEFAULT_BATCH_LIMITS = { maxKeys: 100, maxChars: 50000 };
// Halving three times at most: one batch then becomes up to eight requests.
// A ceiling further off than that means the provider's batch limits are wrong,
// and failing says so where splitting on would only hide it.
const MAX_TRUNCATION_SPLIT_DEPTH = 3;

module.exports = {
  splitIntoBatches,
  translateInBatches,
  DEFAULT_BATCH_LIMITS,
  MAX_TRUNCATION_SPLIT_DEPTH,
};

/**
 * Size of one entry as an LLM writes it back: the answer repeats every key
 * next to its translated value, both JSON-escaped. Measuring the value alone
 * let a batch of short texts behind long keys (`data.headerBlock.…Options.alt`)
 * answer at twice the size its limits allowed for.
 * @param {string} key
 * @param {string} value
 * @returns {number}
 */
function measureEntry(key, value) {
  return JSON.stringify(key).length + JSON.stringify(value || '').length;
}

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
    const entryLength = measureEntry(key, value);

    // Check if adding this entry would exceed limits
    const wouldExceedKeys = currentBatchKeys >= maxKeys;
    const wouldExceedChars = currentBatchChars + entryLength > maxChars;

    // Start new batch if limits exceeded (and current batch is not empty)
    if ((wouldExceedKeys || wouldExceedChars) && currentBatchKeys > 0) {
      batches.push(currentBatch);
      currentBatch = {};
      currentBatchChars = 0;
      currentBatchKeys = 0;
    }

    currentBatch[key] = value;
    currentBatchChars += entryLength;
    currentBatchKeys++;
  }

  // Don't forget the last batch
  if (currentBatchKeys > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Translate already-split batches sequentially.
 * Splitting is done by the caller so that batch counts can be reported
 * before any provider call (avoids the previous duplicate split + extract).
 * @param {Object} params
 * @param {Object} params.provider - AI provider instance
 * @param {Array<Object>} params.batches - Pre-split batches
 * @param {string} params.sourceLanguage - Source language
 * @param {string} params.targetLanguage - Target language
 * @param {string} [params.context] - Additional context for translation (used by DeepL)
 * @param {Function} [params.onBatchProgress] - Callback for batch progress (batchNumber, keysInBatch)
 * @param {Function} [params.assertNotCancelled] - Throws once the job is cancelled; checked before each half of a split batch
 * @returns {Promise<Object>} Merged translations
 */
async function translateInBatches({
  provider,
  batches,
  sourceLanguage,
  targetLanguage,
  context,
  onBatchProgress,
  assertNotCancelled,
}) {
  const totalKeys = batches.reduce(
    (sum, batch) => sum + Object.keys(batch).length,
    0
  );

  logger.log(
    `[Translation] Translating ${totalKeys} keys in ${batches.length} batch(es)`
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

    const batchResult = await translateSplittingOnTruncation({
      provider,
      texts: batch,
      sourceLanguage,
      targetLanguage,
      context, // Passed to provider (DeepL uses this, LLM providers ignore it)
      depth: 0,
      assertNotCancelled,
    });

    results.push(batchResult);

    // Call progress callback if provided
    if (onBatchProgress) {
      await onBatchProgress(i + 1, batchSize);
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

/**
 * Translate one batch, and when the answer comes back cut at the output token
 * ceiling, translate each half instead.
 *
 * The batch limits keep the normal case under the ceiling, but they are an
 * estimate: the answer grows with the target language, and a reasoning model
 * spends part of the same budget thinking. Splitting covers what the estimate
 * misses, for every provider, without retrying a request that cannot fit.
 * @returns {Promise<Object>} Translations for every key of `texts`
 */
async function translateSplittingOnTruncation({
  provider,
  texts,
  depth,
  assertNotCancelled,
  ...params
}) {
  try {
    return await provider.translateBatch({ texts, ...params });
  } catch (error) {
    const entries = Object.entries(texts);
    const canSplit =
      error.code === CODES.OUTPUT_TRUNCATED &&
      entries.length > 1 &&
      depth < MAX_TRUNCATION_SPLIT_DEPTH;
    if (!canSplit) throw error;

    const middle = Math.ceil(entries.length / 2);
    logger.warn(
      `[Translation] Response truncated for ${
        entries.length
      } keys, retrying as ${middle} + ${entries.length - middle} keys (split ${
        depth + 1
      }/${MAX_TRUNCATION_SPLIT_DEPTH})`
    );

    // Sequential, like the batches themselves: halving is no reason to start
    // hitting the provider's rate limit. Checked for a cancel before each
    // half: a split batch is up to fifteen calls, and the batch loop only
    // checks between batches.
    const halves = [entries.slice(0, middle), entries.slice(middle)];
    const translations = {};
    for (const half of halves) {
      if (assertNotCancelled) await assertNotCancelled();
      Object.assign(
        translations,
        await translateSplittingOnTruncation({
          provider,
          texts: Object.fromEntries(half),
          depth: depth + 1,
          assertNotCancelled,
          ...params,
        })
      );
    }
    return translations;
  }
}
