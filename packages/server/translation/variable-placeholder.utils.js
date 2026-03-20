'use strict';

/**
 * Variable Placeholder Utilities
 *
 * Protects dynamic variables in text before translation
 * and restores them after translation.
 *
 * This is necessary because translation services (especially DeepL)
 * may inadvertently modify or translate variable syntax.
 */

// Patterns of variables to protect
// Order matters: more specific patterns should come first
const VARIABLE_PATTERNS = [
  // ESP/CRM variables: %%FIRSTNAME%%, %%UNSUBSCRIBE_LINK%%
  { regex: /%%[A-Z0-9_]+%%/g, name: 'esp' },
  // Handlebars/Mustache: {{variable}}, {{#if}}, {{/if}}
  { regex: /\{\{[^}]+\}\}/g, name: 'handlebars' },
  // Double bracket: [[variable]]
  { regex: /\[\[[^\]]+\]\]/g, name: 'bracket' },
  // Badsender custom tags: <badsender-unsubscribe>, <badsender-mirror>
  { regex: /<badsender-[a-z-]+(?:\s[^>]*)?(?:\/>|>[^<]*<\/badsender-[a-z-]+>|>)/gi, name: 'badsender' },
];

// Placeholder format: __LPVAR_{index}__ (LP = LePatron)
// Using uppercase and underscores to minimize translation interference
const PLACEHOLDER_PREFIX = '__LPVAR_';
const PLACEHOLDER_SUFFIX = '__';

/**
 * Protect variables in text by replacing them with placeholders
 * @param {string} text - Text containing variables
 * @returns {{ protectedText: string, placeholderMap: Object }}
 */
function protectVariables(text) {
  if (!text || typeof text !== 'string') {
    return { protectedText: text || '', placeholderMap: {} };
  }

  const placeholderMap = {};
  let protectedText = text;
  let index = 0;

  // Process each pattern
  for (const pattern of VARIABLE_PATTERNS) {
    protectedText = protectedText.replace(pattern.regex, (match) => {
      const placeholder = `${PLACEHOLDER_PREFIX}${index}${PLACEHOLDER_SUFFIX}`;
      placeholderMap[placeholder] = match;
      index++;
      return placeholder;
    });
  }

  return { protectedText, placeholderMap };
}

/**
 * Restore original variables from placeholders
 * @param {string} text - Text with placeholders
 * @param {Object} placeholderMap - Map of placeholder -> original variable
 * @returns {string} Text with restored variables
 */
function restoreVariables(text, placeholderMap) {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  if (!placeholderMap || Object.keys(placeholderMap).length === 0) {
    return text;
  }

  let restoredText = text;

  // Replace each placeholder with its original value
  for (const [placeholder, original] of Object.entries(placeholderMap)) {
    // Use global replace in case the placeholder appears multiple times
    // (shouldn't happen but defensive coding)
    restoredText = restoredText.split(placeholder).join(original);
  }

  return restoredText;
}

/**
 * Check if text contains any protected variable patterns
 * @param {string} text - Text to check
 * @returns {boolean} True if text contains variables
 */
function containsVariables(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  for (const pattern of VARIABLE_PATTERNS) {
    if (pattern.regex.test(text)) {
      // Reset regex lastIndex for global patterns
      pattern.regex.lastIndex = 0;
      return true;
    }
  }

  return false;
}

module.exports = {
  protectVariables,
  restoreVariables,
  containsVariables,
  VARIABLE_PATTERNS,
  PLACEHOLDER_PREFIX,
  PLACEHOLDER_SUFFIX,
};
