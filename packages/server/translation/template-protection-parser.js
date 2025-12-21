'use strict';

/**
 * Template Protection Parser
 *
 * Parses template HTML markup to extract translation protection configuration
 * based on the `data-translate` attribute with DOM inheritance.
 *
 * Rules:
 * 1. Absent attribute → translated by default (true implicit)
 * 2. data-translate="false" → not translated, descendants inherit false
 * 3. data-translate="true" → translated, descendants inherit true
 * 4. A child can override the value for itself and its descendants
 */

const cheerio = require('cheerio');

/**
 * Parse the template HTML markup to extract protection configuration
 * based on the data-translate attribute and DOM inheritance.
 *
 * @param {string} markup - Template HTML markup
 * @returns {Object} Map { fieldName: false } for each protected editable field
 *                   (only protected fields are included for optimization)
 */
function parseProtectionConfig(markup) {
  if (!markup || typeof markup !== 'string') {
    return {};
  }

  const $ = cheerio.load(markup);
  const config = {};

  // Find all editable elements (data-ko-editable is used by Mosaico/Knockout)
  $('[data-ko-editable]').each((_, element) => {
    const $el = $(element);
    const fieldName = $el.attr('data-ko-editable');

    if (!fieldName) {
      return; // Skip invalid elements
    }

    // Resolve translation state by walking up the DOM tree
    const shouldTranslate = resolveTranslateAttribute($, $el);

    // Only store protected fields (optimization: translatable is the default)
    if (!shouldTranslate) {
      config[fieldName] = false;
    }
  });

  return config;
}

/**
 * Resolve the data-translate attribute by walking up the DOM tree.
 * The first ancestor (including self) with the attribute determines the value.
 *
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {Cheerio} $element - Starting element
 * @returns {boolean} true if translatable, false if protected
 */
function resolveTranslateAttribute($, $element) {
  let $current = $element;

  while ($current.length > 0) {
    const attr = $current.attr('data-translate');

    if (attr !== undefined) {
      // Found the attribute - "true" means translate, anything else means don't
      return attr === 'true';
    }

    $current = $current.parent();
  }

  // No attribute found anywhere in the tree → default is translatable
  return true;
}

/**
 * Check if a specific field is protected from translation.
 *
 * @param {string} fieldName - Name of the field to check
 * @param {Object} protectionConfig - Protection configuration from parseProtectionConfig
 * @returns {boolean} true if the field is protected (should NOT be translated)
 */
function isFieldProtected(fieldName, protectionConfig) {
  if (!protectionConfig || !fieldName) {
    return false;
  }

  return protectionConfig[fieldName] === false;
}

module.exports = {
  parseProtectionConfig,
  isFieldProtected,
  // Exported for testing
  resolveTranslateAttribute,
};
