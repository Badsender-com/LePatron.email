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

const {
  parseElementTree,
  getAttribute,
} = require('./template-element-tree.js');

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

  const protectedBlocks = new Set();
  const editables = [];

  // One walk in document order. Each element inherits the closest block
  // (itself included) and the closest data-translate value; an element
  // carrying either attribute overrides it for itself and its descendants.
  // Iterative: a deeply nested template must not exhaust the stack. The
  // content of a <template> element is not walked, as the browser does not
  // expose it to the editor either.
  const stack = [{ node: parseElementTree(markup) }];
  while (stack.length > 0) {
    const { node, blockName, translateAttr } = stack.pop();
    let ownBlockName = blockName;
    let ownTranslateAttr = translateAttr;

    if (node.attrs) {
      const nodeBlockName = getAttribute(node, 'data-ko-block');
      const nodeTranslateAttr = getAttribute(node, 'data-translate');

      // A block with data-translate="false" is fully protected
      if (nodeBlockName !== undefined) {
        ownBlockName = nodeBlockName;
        if (nodeTranslateAttr === 'false') protectedBlocks.add(nodeBlockName);
      }
      if (nodeTranslateAttr !== undefined) ownTranslateAttr = nodeTranslateAttr;

      const fieldName = getAttribute(node, 'data-ko-editable');
      if (fieldName) {
        editables.push({
          fieldName,
          blockName: ownBlockName || '_root',
          // No attribute anywhere up the tree: translatable by default.
          // Otherwise "true" means translate, anything else means don't.
          shouldTranslate:
            ownTranslateAttr === undefined || ownTranslateAttr === 'true',
        });
      }
    }

    const children = node.childNodes || [];
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({
        node: children[i],
        blockName: ownBlockName,
        translateAttr: ownTranslateAttr,
      });
    }
  }

  // Resolved once every block is known: a block name protected further down
  // the document protects the fields of its earlier instances too.
  const protectedFields = {};
  for (const { fieldName, blockName, shouldTranslate } of editables) {
    if (protectedBlocks.has(blockName)) {
      // Block is protected - only an explicit data-translate="true" is an
      // exception worth storing; otherwise inherited from the block
      if (shouldTranslate) {
        protectedFields[`${blockName}.${fieldName}`] = true;
      }
    } else if (!shouldTranslate) {
      // Block is not protected - the field itself is
      protectedFields[`${blockName}.${fieldName}`] = false;
    }
  }

  return {
    _protectedBlocks: Array.from(protectedBlocks),
    _protectedFields: protectedFields,
  };
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
};
