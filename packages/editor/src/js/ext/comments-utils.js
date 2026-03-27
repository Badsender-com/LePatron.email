'use strict';

/**
 * Utility functions for the comments extension
 * Pure functions with no viewModel dependencies
 */

const _ = require('lodash');

// ===== BLOCK UTILITIES =====

/**
 * Format a block type name for display (e.g., "textimageBlock" -> "Text Image")
 * @param {string} blockType - The raw block type
 * @returns {string} - Formatted block name
 */
function formatBlockName(blockType) {
  if (!blockType) return '';
  // Remove "Block" suffix and convert to title case
  return _.startCase(blockType.replace(/Block$/i, ''));
}

/**
 * Get block type from block data, handling observables
 * @param {Object} blockData - The block data (may contain observables)
 * @returns {string|null} - The block type or null
 */
function getBlockType(blockData) {
  if (!blockData) return null;
  let blockType = blockData._type || blockData.type;
  if (typeof blockType === 'function') blockType = blockType();
  if (typeof blockType === 'object' && blockType !== null) {
    blockType = blockType.name || blockType.label || null;
  }
  return blockType || null;
}

/**
 * Get formatted block label with numbering for duplicates
 * @param {Array} blocks - All blocks in the email
 * @param {string} targetBlockId - The block ID to get label for
 * @returns {string|null} - Formatted label like "Header Block" or "Title Block #2"
 */
function getBlockLabelWithNumber(blocks, targetBlockId) {
  if (!blocks || !targetBlockId) return null;

  let targetType = null;
  let targetIndex = -1;

  // First pass: find the target block and its type
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockData = typeof block === 'function' ? block() : block;
    if (!blockData) continue;

    const id = typeof blockData.id === 'function' ? blockData.id() : blockData.id;
    if (id === targetBlockId) {
      targetType = getBlockType(blockData);
      targetIndex = i;
      break;
    }
  }

  if (!targetType) return null;

  // Second pass: count blocks of the same type and find position
  let sameTypeCount = 0;
  let positionAmongSameType = 0;

  for (let j = 0; j < blocks.length; j++) {
    const block = blocks[j];
    const blockData = typeof block === 'function' ? block() : block;
    if (!blockData) continue;

    const blockType = getBlockType(blockData);
    if (blockType === targetType) {
      sameTypeCount++;
      if (j < targetIndex) {
        positionAmongSameType++;
      } else if (j === targetIndex) {
        positionAmongSameType++; // This is our block's position (1-indexed)
      }
    }
  }

  const formattedName = formatBlockName(targetType);

  // Add number only if there are multiple blocks of the same type
  if (sameTypeCount > 1) {
    return formattedName + ' #' + positionAmongSameType;
  }

  return formattedName;
}

// ===== DATE FORMATTING =====

/**
 * Format date for display (relative format)
 * Uses translation function for localized output
 * @param {string} dateString - ISO date string
 * @param {Function} t - Translation function
 * @returns {string} - Formatted date
 */
function formatCommentDate(dateString, t) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return t('comments-date-now');
  } else if (diffMins < 60) {
    return diffMins + ' min';
  } else if (diffHours < 24) {
    return diffHours + 'h';
  } else if (diffDays < 7) {
    return diffDays + (t('comments-date-days-suffix') || 'j');
  } else {
    // Use localized month names from translation
    const monthKey = 'comments-date-month-' + date.getMonth();
    const month = t(monthKey) || getDefaultMonth(date.getMonth());
    const day = date.getDate();
    const year = date.getFullYear();
    const currentYear = now.getFullYear();
    if (year === currentYear) {
      return day + ' ' + month;
    }
    return day + ' ' + month + ' ' + year;
  }
}

/**
 * Get default month abbreviation (fallback if translation missing)
 * @param {number} monthIndex - Month index (0-11)
 * @returns {string} - Month abbreviation
 */
function getDefaultMonth(monthIndex) {
  const months = ['jan.', 'feb.', 'mar.', 'apr.', 'may', 'jun.', 'jul.', 'aug.', 'sep.', 'oct.', 'nov.', 'dec.'];
  return months[monthIndex] || '';
}

// ===== TEXT UTILITIES =====

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Raw text
 * @returns {string} - HTML-escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format comment text with styled mentions
 * Converts @[Name](userId) to <span class="comment-mention">@Name</span>
 * @param {string} text - Raw comment text
 * @returns {string} - HTML with styled mentions
 */
function formatCommentText(text) {
  if (!text) return '';

  // First escape HTML
  let escaped = escapeHtml(text);

  // Then replace mention patterns with styled spans
  const mentionRegex = /@\[([^\]]+)\]\([a-f0-9]+\)/g;
  escaped = escaped.replace(mentionRegex, '<span class="comment-mention">@$1</span>');

  // Convert newlines to <br>
  escaped = escaped.replace(/\n/g, '<br>');

  return escaped;
}

// ===== MENTION UTILITIES =====

/**
 * Parse text to find mention trigger (@)
 * @param {string} text - Full textarea text
 * @param {number} cursorPos - Current cursor position
 * @returns {Object|null} - { atIndex, query } or null if not in mention context
 */
function findMentionContext(text, cursorPos) {
  const textBeforeCursor = text.substring(0, cursorPos);
  const atIndex = textBeforeCursor.lastIndexOf('@');

  if (atIndex === -1) return null;

  const textAfterAt = textBeforeCursor.substring(atIndex + 1);
  // Check if we're in the middle of typing a mention (no space after @)
  if (/\s/.test(textAfterAt)) return null;

  return {
    atIndex: atIndex,
    query: textAfterAt,
  };
}

/**
 * Reconstruct text with full mention format for storage
 * Converts "@Name" to "@[Name](userId)" using tracked mentions
 * @param {string} text - Display text with @Name mentions
 * @param {Array} trackedMentions - Array of { name, userId, displayText }
 * @returns {string} - Text with full mention format
 */
function reconstructMentionsForStorage(text, trackedMentions) {
  let result = text;

  // Process each tracked mention
  trackedMentions.forEach(function (mention) {
    const displayText = mention.displayText; // "@Name"
    const fullFormat = '@[' + mention.name + '](' + mention.userId + ')';
    // Replace only if the display text still exists in the text
    if (result.indexOf(displayText) !== -1) {
      // Replace first occurrence only (in case of duplicate names)
      result = result.replace(displayText, fullFormat);
    }
  });

  return result;
}

/**
 * Extract mention user IDs from tracked mentions that are still in the text
 * @param {string} text - Display text to check
 * @param {Array} trackedMentions - Array of { name, userId, displayText }
 * @returns {Array} - Array of user IDs
 */
function extractMentionIds(text, trackedMentions) {
  const mentions = [];

  trackedMentions.forEach(function (mention) {
    // Check if this mention is still in the text
    if (text.indexOf(mention.displayText) !== -1) {
      mentions.push(mention.userId);
    }
  });

  return mentions;
}

// ===== EXPORTS =====

module.exports = {
  // Block utilities
  formatBlockName: formatBlockName,
  getBlockType: getBlockType,
  getBlockLabelWithNumber: getBlockLabelWithNumber,

  // Date formatting
  formatCommentDate: formatCommentDate,

  // Text utilities
  escapeHtml: escapeHtml,
  formatCommentText: formatCommentText,

  // Mention utilities
  findMentionContext: findMentionContext,
  reconstructMentionsForStorage: reconstructMentionsForStorage,
  extractMentionIds: extractMentionIds,
};
