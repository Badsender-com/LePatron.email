'use strict';

/**
 * Mosaico Text Injector
 *
 * Injects translated texts back into Mosaico email data.
 * Uses the same dot-notation keys from the extractor.
 */

/**
 * Set a value in an object using dot notation path
 * @param {Object} obj - Object to modify
 * @param {string} path - Dot notation path (e.g., "data.block.text")
 * @param {*} value - Value to set
 */
function setByPath(obj, path, value) {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];

    // Handle array indices
    const arrayMatch = part.match(/^(\d+)$/);
    if (arrayMatch) {
      const index = parseInt(arrayMatch[1], 10);
      if (!Array.isArray(current)) {
        return false; // Path mismatch
      }
      if (current[index] === undefined) {
        return false; // Index out of bounds
      }
      current = current[index];
    } else {
      if (current[part] === undefined) {
        return false; // Path doesn't exist
      }
      current = current[part];
    }
  }

  const lastPart = parts[parts.length - 1];

  // Handle array index for last part
  const arrayMatch = lastPart.match(/^(\d+)$/);
  if (arrayMatch) {
    const index = parseInt(arrayMatch[1], 10);
    if (Array.isArray(current) && current[index] !== undefined) {
      current[index] = value;
      return true;
    }
    return false;
  }

  if (current[lastPart] !== undefined) {
    current[lastPart] = value;
    return true;
  }

  return false;
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
    const success = setByPath(result, key, translatedValue);
    if (success) {
      injectionResults.success.push(key);
    } else {
      injectionResults.failed.push(key);
    }
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

  const missing = originalKeys.filter((k) => !translatedKeys.includes(k));
  const extra = translatedKeys.filter((k) => !originalKeys.includes(k));

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
