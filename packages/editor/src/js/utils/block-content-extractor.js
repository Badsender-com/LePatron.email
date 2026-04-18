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

  console.log(`[BlockExtractor] setNestedProperty path="${path}", parts=`, parts, 'last=', last);

  let current = obj;
  for (const part of parts) {
    console.log(`[BlockExtractor] Navigating to "${part}", current type:`, typeof current);

    // Handle array indices
    if (!isNaN(part)) {
      const index = parseInt(part, 10);

      // Unwrap observable if needed
      let target = current[index];
      if (typeof target === 'function' && target.subscribe !== undefined) {
        console.log(`[BlockExtractor] Unwrapping observable at index ${index}`);
        target = target();
      }

      if (!target) {
        current[index] = {};
        target = current[index];
      }
      current = target;
    } else {
      // Unwrap observable if needed
      let target = current[part];
      console.log(`[BlockExtractor] At "${part}", target type:`, typeof target, 'isObservable:', typeof target === 'function' && target?.subscribe !== undefined);

      if (typeof target === 'function' && target.subscribe !== undefined) {
        console.log(`[BlockExtractor] Unwrapping observable "${part}"`);
        target = target();
        console.log(`[BlockExtractor] Unwrapped value type:`, typeof target);
      }

      if (!target) {
        current[part] = {};
        target = current[part];
      }
      current = target;
    }
  }

  console.log(`[BlockExtractor] Final current type:`, typeof current, 'current:', current);
  console.log(`[BlockExtractor] Checking "${last}", type:`, typeof current[last], 'isObservable:', typeof current[last] === 'function' && current[last]?.subscribe !== undefined);

  // Handle Knockout observables for final property
  if (
    typeof current[last] === 'function' &&
    current[last].subscribe !== undefined
  ) {
    // It's a Knockout observable - set it
    console.log(`[BlockExtractor] Setting observable "${last}" to:`, value);
    current[last](value);
  } else {
    console.log(`[BlockExtractor] Setting property "${last}" to:`, value);
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

  // If blockObservable is itself an observable function, unwrap it first to get the actual block object
  let targetBlock = blockObservable;
  if (typeof blockObservable === 'function' && blockObservable.subscribe !== undefined) {
    console.log('[BlockExtractor] Root block is an observable, unwrapping it');
    targetBlock = blockObservable();
  }

  console.log('[BlockExtractor] Target block type:', typeof targetBlock);

  Object.keys(translations).forEach((key) => {
    const translatedValue = translations[key];
    if (translatedValue !== null && translatedValue !== undefined) {
      try {
        console.log(`[BlockExtractor] Injecting "${key}":`, translatedValue);
        setNestedProperty(targetBlock, key, translatedValue);
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
