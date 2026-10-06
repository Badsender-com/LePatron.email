'use strict';

// What a completed duplicate + translate job asks the user to check.

// Warning keys are translated by the frontend
// (packages/ui/components/mailings/modal-translation-warning.vue).
const WARNING_KEYS = [
  'translation.warnings.checkLinks',
  'translation.warnings.checkImages',
  'translation.warnings.checkVariant',
];

// Some composed block is not what the translation promised: left in the
// source language (too large once rebuilt, or not found in the preview), or
// rebuilt by the current generator rather than the one that wrote it. Each is logged
// where it happens; this is what tells the user, who can only fix it in the
// editor.
const COMPOSED_BLOCK_WARNING_KEY =
  'translation.warnings.composedBlockUntranslated';

/**
 * @param {Object} stats the job's translation stats
 * @param {number} missedComposedBlocks rebuilt blocks the preview could not
 *   place
 * @returns {string[]}
 */
function warningKeysFor(stats, missedComposedBlocks) {
  const unfaithful =
    (stats.composedBlocksOversized || 0) +
    (stats.composedBlocksOutdated || 0) +
    missedComposedBlocks;
  return unfaithful > 0
    ? [...WARNING_KEYS, COMPOSED_BLOCK_WARNING_KEY]
    : WARNING_KEYS;
}

module.exports = { WARNING_KEYS, COMPOSED_BLOCK_WARNING_KEY, warningKeysFor };
