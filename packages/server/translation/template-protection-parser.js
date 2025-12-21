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
 *
 * Returns:
 * - _protectedBlocks: Array of block names that are fully protected
 * - _protectedFields: Map of { 'blockName.fieldName': false } for field-level protection
 */

const cheerio = require('cheerio');

/**
 * Parse the template HTML markup to extract protection configuration
 * based on the data-translate attribute and DOM inheritance.
 *
 * @param {string} markup - Template HTML markup
 * @returns {Object} Protection config with:
 *   - _protectedBlocks: string[] - Block names that are fully protected
 *   - _protectedFields: { 'blockName.fieldName': false } - Field-level protection
 */
function parseProtectionConfig(markup) {
  if (!markup || typeof markup !== 'string') {
    return { _protectedBlocks: [], _protectedFields: {} };
  }

  const $ = cheerio.load(markup);
  const protectedBlocks = new Set();
  const protectedFields = {};

  // First pass: find all blocks with data-translate="false" at block level
  $('[data-ko-block]').each((_, element) => {
    const $block = $(element);
    const blockName = $block.attr('data-ko-block');
    const translateAttr = $block.attr('data-translate');

    if (translateAttr === 'false') {
      protectedBlocks.add(blockName);
    }
  });

  // Second pass: find field-level protection (fields inside protected blocks
  // that have data-translate="true" override, or fields with direct protection)
  $('[data-ko-editable]').each((_, element) => {
    const $el = $(element);
    const fieldName = $el.attr('data-ko-editable');

    if (!fieldName) {
      return;
    }

    // Find parent block
    const $parentBlock = $el.closest('[data-ko-block]');
    const blockName = $parentBlock.attr('data-ko-block') || '_root';

    // Resolve translation state by walking up the DOM tree
    const shouldTranslate = resolveTranslateAttribute($, $el);

    // Check if this is an exception inside a protected block
    if (protectedBlocks.has(blockName)) {
      // Block is protected - check if this field has an explicit override
      if (shouldTranslate) {
        // Field has data-translate="true" - it's an exception, store it
        protectedFields[`${blockName}.${fieldName}`] = true; // translatable exception
      }
      // Otherwise, inherited from block - no need to store
    } else {
      // Block is not protected - check if field has direct protection
      if (!shouldTranslate) {
        protectedFields[`${blockName}.${fieldName}`] = false;
      }
    }
  });

  return {
    _protectedBlocks: Array.from(protectedBlocks),
    _protectedFields: protectedFields,
  };
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
 * Uses the path to determine which block the field is in.
 *
 * @param {string} path - Full dot-notation path (e.g., 'data.footerBlock.legalText')
 * @param {string} fieldName - Name of the field (e.g., 'legalText')
 * @param {Object} protectionConfig - Protection configuration from parseProtectionConfig
 * @returns {boolean} true if the field is protected (should NOT be translated)
 */
function isFieldProtected(path, fieldName, protectionConfig) {
  if (!protectionConfig || !fieldName) {
    return false;
  }

  const { _protectedBlocks = [], _protectedFields = {} } = protectionConfig;

  // Find which block this path belongs to by checking path segments
  const pathSegments = path.split('.');

  for (const segment of pathSegments) {
    // Check if this segment is a protected block
    if (_protectedBlocks.includes(segment)) {
      // Block is protected - check if there's a field-level exception
      const exceptionKey = `${segment}.${fieldName}`;
      if (_protectedFields[exceptionKey] === true) {
        // Field has explicit data-translate="true" - it's an exception
        return false; // NOT protected (should be translated)
      }
      // No exception - field is protected
      return true;
    }

    // Check for field-level protection in non-protected blocks
    const fieldKey = `${segment}.${fieldName}`;
    if (_protectedFields[fieldKey] === false) {
      return true; // Field is explicitly protected
    }
  }

  return false;
}

module.exports = {
  parseProtectionConfig,
  isFieldProtected,
  // Exported for testing
  resolveTranslateAttribute,
};
