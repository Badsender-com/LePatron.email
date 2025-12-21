'use strict';

/**
 * Mosaico Text Extractor
 *
 * Extracts translatable text fields from Mosaico email data.
 * Returns a flat object with dot-notation keys for easy translation and re-injection.
 *
 * Translatable content includes:
 * - Text content (text, titleText, bodyText, preheaderText, etc.)
 * - Button labels (buttonText)
 * - Image alt text (imageAlt, altText)
 *
 * Non-translatable content (excluded):
 * - URLs (http://, https://, mailto:)
 * - Email addresses
 * - Color values (#hex, rgb())
 * - Numeric values
 * - Empty strings
 * - Mosaico expressions (@[...])
 */

// Patterns for content that should NOT be translated
const URL_PATTERN = /^(https?:\/\/|mailto:|tel:)/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLOR_PATTERN = /^(#[0-9a-f]{3,8}|rgba?\([^)]+\)|transparent)$/i;
const MOSAICO_VAR_ONLY_PATTERN = /^@\[[^\]]+\]$/;
const NUMERIC_PATTERN = /^-?\d+(\.\d+)?(px|em|rem|%)?$/;

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
];

/**
 * Check if a field name is likely to contain translatable text
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
 */
function isTranslatableValue(value) {
  // Must be a non-empty string
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }

  const trimmed = value.trim();

  // Exclude URLs
  if (URL_PATTERN.test(trimmed)) {
    return false;
  }

  // Exclude email addresses
  if (EMAIL_PATTERN.test(trimmed)) {
    return false;
  }

  // Exclude color values
  if (COLOR_PATTERN.test(trimmed)) {
    return false;
  }

  // Exclude pure Mosaico variables (but keep mixed content like "Hello @[name]")
  if (MOSAICO_VAR_ONLY_PATTERN.test(trimmed)) {
    return false;
  }

  // Exclude pure numeric values
  if (NUMERIC_PATTERN.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Extract text from HTML content, preserving structure
 * Returns the HTML as-is since we want to translate the full HTML content
 */
function extractHtmlText(html) {
  // Return HTML as-is - the LLM will handle HTML content
  // It should preserve tags and only translate text nodes
  return html;
}

/**
 * Recursively extract translatable fields from an object
 * @param {Object} obj - Object to extract from
 * @param {string} prefix - Current key prefix (for dot notation)
 * @param {Object} result - Accumulator object
 * @param {Object} [protectionConfig] - Optional protection configuration from template
 */
function extractFromObject(obj, prefix = '', result = {}, protectionConfig = null) {
  if (!obj || typeof obj !== 'object') {
    return result;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const key = prefix ? `${prefix}.${index}` : `${index}`;
      if (typeof item === 'object') {
        extractFromObject(item, key, result, protectionConfig);
      } else if (typeof item === 'string' && isTranslatableValue(item)) {
        result[key] = item;
      }
    });
    return result;
  }

  // Handle objects
  for (const [fieldName, value] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${fieldName}` : fieldName;

    if (value === null || value === undefined) {
      continue;
    }

    // Check if this field is protected from translation (via data-translate="false" in template)
    if (protectionConfig && protectionConfig[fieldName] === false) {
      continue; // Skip protected fields
    }

    if (typeof value === 'object') {
      // Recurse into nested objects, but skip style objects
      if (!fieldName.toLowerCase().includes('style')) {
        extractFromObject(value, key, result, protectionConfig);
      }
    } else if (typeof value === 'string') {
      // Check if this field should be translated
      if (isTranslatableFieldName(fieldName) && isTranslatableValue(value)) {
        result[key] = extractHtmlText(value);
      }
    }
  }

  return result;
}

/**
 * Extract all translatable text from a Mosaico mailing
 * @param {Object} mailing - Mailing document with name and data
 * @param {Object} [protectionConfig] - Optional protection configuration from template
 *                                      (fields marked as protected will be excluded)
 * @returns {Object} Flat object with translatable texts
 */
function extractTexts(mailing, protectionConfig = null) {
  const result = {};

  // Extract email name/subject (never protected - it's not a template field)
  if (mailing.name && isTranslatableValue(mailing.name)) {
    result._name = mailing.name;
  }

  // Extract from Mosaico data
  if (mailing.data) {
    extractFromObject(mailing.data, 'data', result, protectionConfig);
  }

  return result;
}

/**
 * Get statistics about extracted texts
 * @param {Object} texts - Extracted texts object
 * @returns {Object} Statistics
 */
function getExtractionStats(texts) {
  const keys = Object.keys(texts);
  const totalChars = Object.values(texts).reduce(
    (sum, text) => sum + text.length,
    0
  );

  return {
    fieldCount: keys.length,
    totalCharacters: totalChars,
    fields: keys,
  };
}

module.exports = {
  extractTexts,
  getExtractionStats,
  // Exported for testing
  isTranslatableFieldName,
  isTranslatableValue,
};
