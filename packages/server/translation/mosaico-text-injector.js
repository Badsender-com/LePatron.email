'use strict';

/**
 * Mosaico Text Injector
 *
 * Injects translated texts back into Mosaico email data.
 * Uses the same dot-notation keys from the extractor.
 */

// Path segments that name an object's machinery rather than its data. The keys
// come back from a translation provider, so a path is followed only through
// the mailing's own properties — never up into a prototype.
const RESERVED_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

const hasOwn = (object, key) =>
  object !== null &&
  typeof object === 'object' &&
  Object.prototype.hasOwnProperty.call(object, key);

/**
 * Set a value in an object using dot notation path
 *
 * Only an existing property of the object itself, reached through its own
 * properties, is written: the injector replaces texts, it never adds a key.
 *
 * @param {Object} obj - Object to modify
 * @param {string} path - Dot notation path (e.g., "data.block.text")
 * @param {*} value - Value to set
 * @returns {boolean} whether the value was written
 */
function setByPath(obj, path, value) {
  if (typeof path !== 'string') return false;
  const parts = path.split('.');
  if (parts.some((part) => part === '' || RESERVED_SEGMENTS.has(part))) {
    return false;
  }

  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!hasOwn(current, parts[i])) return false;
    current = current[parts[i]];
  }

  const lastPart = parts[parts.length - 1];
  if (!hasOwn(current, lastPart)) return false;

  current[lastPart] = value;
  return true;
}

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Inject translated texts into a mailing
 * @param {Object} mailing - Original mailing document
 * @param {Object} translations - Object with translated texts (same keys as extractor output)
 * @returns {Object} New mailing object with translated content
 */
function injectTexts(mailing, translations) {
  // Deep clone to avoid mutating original
  const result = deepClone(mailing);

  const injectionResults = {
    success: [],
    failed: [],
  };

  for (const [key, translatedValue] of Object.entries(translations)) {
    // Handle special _name key for email subject
    if (key === '_name') {
      result.name = translatedValue;
      injectionResults.success.push(key);
      continue;
    }

    // Handle data paths
    const target = setByPath(result, key, translatedValue)
      ? injectionResults.success
      : injectionResults.failed;
    target.push(key);
  }

  return {
    mailing: result,
    stats: {
      injected: injectionResults.success.length,
      failed: injectionResults.failed.length,
      failedKeys: injectionResults.failed,
    },
  };
}

/**
 * Validate that translations match expected structure
 * @param {Object} originalTexts - Original extracted texts
 * @param {Object} translations - Translated texts
 * @returns {Object} Validation result
 */
function validateTranslations(originalTexts, translations) {
  const originalKeys = Object.keys(originalTexts);
  const translatedKeys = Object.keys(translations);
  const originalSet = new Set(originalKeys);
  const translatedSet = new Set(translatedKeys);

  const missing = originalKeys.filter((k) => !translatedSet.has(k));
  const extra = translatedKeys.filter((k) => !originalSet.has(k));

  return {
    isValid: missing.length === 0 && extra.length === 0,
    missing,
    extra,
    originalCount: originalKeys.length,
    translatedCount: translatedKeys.length,
  };
}

module.exports = {
  injectTexts,
  validateTranslations,
  // Exported for testing
  setByPath,
  deepClone,
};
