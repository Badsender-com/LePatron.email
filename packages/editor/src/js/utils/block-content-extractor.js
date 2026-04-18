'use strict';

/**
 * Block Content Extractor
 *
 * Extracts and injects translatable text fields from/to email editor blocks.
 * Similar to mosaico-text-extractor but designed for single-block operations.
 *
 * Translatable content includes:
 * - Text content (text, titleText, bodyText, preheaderText, etc.)
 * - Button labels (buttonText, label)
 * - Image alt text (imageAlt, altText, title)
 *
 * Non-translatable content (excluded):
 * - URLs (href, src, url, link)
 * - Colors (backgroundColor, textColor, color)
 * - Styles and technical fields
 * - Mosaico variables and ESP tags
 */

// Patterns for content that should NOT be translated
const NON_TRANSLATABLE_PATTERNS = [
  /^(https?:\/\/|mailto:|tel:)/i, // URLs
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // Email addresses
  /^(#[0-9a-f]{3,8}|rgba?\([^)]+\)|transparent)$/i, // Color values
  /^@\[[^\]]+\]$/, // Pure Mosaico variables (keeps mixed content like "Hello @[name]")
  /^-?\d+(\.\d+)?(px|em|rem|%)?$/, // Numeric values
];

// Field name patterns that typically contain translatable text
const TRANSLATABLE_FIELD_PATTERNS = [
  /text$/i, // *Text (buttonText, titleText, preheaderText, etc.)
  /^text$/i, // text
  /title$/i, // *Title
  /label$/i, // *Label
  /alt$/i, // *Alt (imageAlt, altText)
  /heading$/i, // *Heading
  /content$/i, // *Content
  /description$/i, // *Description
  /caption$/i, // *Caption
  /placeholder$/i, // *Placeholder
];

// Field names that should be excluded even if they match patterns
const EXCLUDED_FIELDS = [
  'backgroundColor',
  'textColor',
  'linkColor',
  'buttonColor',
  'borderColor',
  'color',
  'bgColor',
  'textStyle',
  'titleTextStyle',
  'bodyTextStyle',
];

// Field names that contain URLs (never translate)
const URL_FIELDS = [
  'href',
  'src',
  'url',
  'link',
  'image',
  'buttonLink',
  'imageLink',
  'backgroundImage',
  'bgimage',
  'mobileBgimage',
  'outlookBgImage',
];

/**
 * Check if a field name is likely to contain translatable text
 * @param {string} fieldName - Field name to check
 * @returns {boolean} True if field is likely translatable
 */
function isTranslatableFieldName(fieldName) {
  const lowerName = fieldName.toLowerCase();

  // Exclude known non-translatable fields
  if (EXCLUDED_FIELDS.some((f) => lowerName === f.toLowerCase())) {
    return false;
  }

  // Check if matches translatable patterns FIRST (before URL exclusion)
  // This allows fields like "imageAlt" to be included (ends with "alt")
  const matchesTranslatable = TRANSLATABLE_FIELD_PATTERNS.some((pattern) =>
    pattern.test(fieldName)
  );

  if (matchesTranslatable) {
    return true;
  }

  // Exclude URL fields (only if not already matched as translatable)
  if (URL_FIELDS.some((f) => lowerName.includes(f.toLowerCase()))) {
    return false;
  }

  return false;
}

/**
 * Check if a value should be translated
 * @param {*} value - Value to check
 * @returns {boolean} True if value should be translated
 */
function isTranslatableValue(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }

  const trimmed = value.trim();
  return !NON_TRANSLATABLE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Recursively extract translatable fields from a block object
 * @param {Object} obj - Object to extract from
 * @param {string} prefix - Current key prefix (for dot notation)
 * @param {Object} result - Accumulator object
 * @returns {Object} Result object with extracted texts
 */
function extractFromObject(obj, prefix = '', result = {}) {
  if (!obj || typeof obj !== 'object') {
    return result;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const key = prefix ? `${prefix}.${index}` : `${index}`;
      if (typeof item === 'object') {
        extractFromObject(item, key, result);
      } else if (typeof item === 'string' && isTranslatableValue(item)) {
        result[key] = item;
      }
    });
    return result;
  }

  // Handle objects
  Object.keys(obj).forEach((fieldName) => {
    const value = obj[fieldName];
    const key = prefix ? `${prefix}.${fieldName}` : fieldName;

    // Skip null/undefined
    if (value === null || value === undefined) {
      return;
    }

    // If it's a translatable field with string value
    if (
      isTranslatableFieldName(fieldName) &&
      typeof value === 'string' &&
      isTranslatableValue(value)
    ) {
      result[key] = value;
    }
    // Recursively process nested objects/arrays
    else if (typeof value === 'object') {
      extractFromObject(value, key, result);
    }
  });

  return result;
}

/**
 * Extract translatable content from a single block
 * @param {Object} blockData - Unwrapped block data (plain JavaScript object)
 * @returns {Object} Flat object with translatable texts (dot-notation keys)
 *
 * @example
 * const block = {
 *   text: "Hello world",
 *   buttonText: "Click here",
 *   href: "https://example.com", // NOT extracted
 *   style: {
 *     color: "#000000" // NOT extracted
 *   }
 * };
 *
 * extractBlockTranslatableContent(block);
 * // Returns: { "text": "Hello world", "buttonText": "Click here" }
 */
function extractBlockTranslatableContent(blockData) {
  if (!blockData || typeof blockData !== 'object') {
    return {};
  }

  const result = {};
  extractFromObject(blockData, '', result);
  console.log('[BlockExtractor] Extracted fields:', Object.keys(result));
  console.log('[BlockExtractor] Full extraction:', result);
  return result;
}

/**
 * Set a nested property value using dot notation
 * @param {Object} obj - Object to modify
 * @param {string} path - Dot-notation path (e.g., "style.color")
 * @param {*} value - Value to set
 */
function setNestedProperty(obj, path, value) {
  const parts = path.split('.');
  const last = parts.pop();

  let current = obj;
  for (const part of parts) {
    // Handle array indices
    if (!isNaN(part)) {
      const index = parseInt(part, 10);
      if (!current[index]) {
        current[index] = {};
      }
      current = current[index];
    } else {
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
  }

  // Handle Knockout observables
  if (
    typeof current[last] === 'function' &&
    current[last].subscribe !== undefined
  ) {
    // It's a Knockout observable
    current[last](value);
  } else {
    current[last] = value;
  }
}

/**
 * Inject translated content back into block observables
 * @param {Object} blockObservable - Knockout observable block (with observables intact)
 * @param {Object} translations - Translated content (flat object with dot-notation keys)
 *
 * @example
 * const block = {
 *   text: ko.observable("Hello world"),
 *   buttonText: ko.observable("Click here")
 * };
 *
 * const translations = {
 *   "text": "Bonjour le monde",
 *   "buttonText": "Cliquez ici"
 * };
 *
 * injectBlockTranslations(block, translations);
 * // block.text() === "Bonjour le monde"
 * // block.buttonText() === "Cliquez ici"
 */
function injectBlockTranslations(blockObservable, translations) {
  if (!blockObservable || !translations || typeof translations !== 'object') {
    console.log('[BlockExtractor] Injection skipped - invalid input');
    return;
  }

  console.log('[BlockExtractor] Injecting translations for keys:', Object.keys(translations));

  Object.keys(translations).forEach((key) => {
    const translatedValue = translations[key];
    if (translatedValue !== null && translatedValue !== undefined) {
      try {
        console.log(`[BlockExtractor] Injecting "${key}":`, translatedValue);
        setNestedProperty(blockObservable, key, translatedValue);
      } catch (error) {
        console.error(`Failed to inject translation for key "${key}":`, error);
      }
    }
  });

  console.log('[BlockExtractor] Injection completed');
}

module.exports = {
  extractBlockTranslatableContent,
  injectBlockTranslations,
  // Export for testing
  isTranslatableFieldName,
  isTranslatableValue,
};
