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

// The syntaxes of the variables, each once: `protect` is what a translation
// keeps intact, `read` the name an assistant is told about (MCP, ADR 0012),
// in group 1, its blanks to trim. A name read is at most 100 characters, so
// that it is found in linear time.
// Order matters: more specific patterns should come first
const VARIABLE_SYNTAXES = [
  // ESP/CRM variables: %%FIRSTNAME%%, %%UNSUBSCRIBE_LINK%%. An ESP reads
  // %%FirstName%% too: a name is read whatever its case.
  {
    name: 'esp',
    protect: /%%[A-Z0-9_]+%%/g,
    read: /%%([A-Za-z][A-Za-z0-9_]{0,99})%%/g,
  },
  // Handlebars/Mustache: {{variable}}, {{{variable}}}, {{#if}}, {{/if}}
  {
    name: 'handlebars',
    protect: /\{\{[^}]+\}\}/g,
    read: /\{\{\{?([^{}]{1,100})\}?\}\}/g,
  },
  // Double bracket: [[variable]]
  {
    name: 'bracket',
    protect: /\[\[[^\]]+\]\]/g,
    read: /\[\[([^[\]]{1,100})\]\]/g,
  },
  // Badsender custom tags: <badsender-unsubscribe>, <badsender-mirror>. The
  // app fills them, never an ESP, and a sanitised preview no longer holds
  // them: none is read.
  {
    name: 'badsender',
    protect: /<badsender-[a-z-]+(?:\s[^>]*)?(?:\/>|>[^<]*<\/badsender-[a-z-]+>|>)/gi,
  },
];

// Patterns of variables to protect
const VARIABLE_PATTERNS = VARIABLE_SYNTAXES.map(({ name, protect }) => ({
  regex: protect,
  name,
}));

// Patterns of the variables to name, the name in group 1
const VARIABLE_NAME_PATTERNS = VARIABLE_SYNTAXES.filter(({ read }) => read).map(
  ({ read }) => read
);

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
  VARIABLE_NAME_PATTERNS,
  PLACEHOLDER_PREFIX,
  PLACEHOLDER_SUFFIX,
};
