'use strict';

const $ = require('jquery');
const ko = require('knockout');
const _ = require('lodash');

/**
 * Format a block type name for display (e.g., "textimageBlock" -> "Text Image")
 */
function formatBlockName(blockName) {
  if (!blockName) return '';
  return _.startCase(blockName.replace('Block', ''));
}

/**
 * Comments extension for the Mosaico editor
 * Adds collaborative commenting functionality on blocks
 */
function commentsLoader(opts) {
  const mailingId = opts.metadata.id;
  const groupId = opts.metadata.groupId;
  const apiBaseUrl = '/api';

  return function (viewModel) {
    // ===== OBSERVABLES =====
    viewModel.showComments = ko.observable(false);
    viewModel.comments = ko.observableArray([]);
    viewModel.commentsStatus = ko.observable(false); // false | 'loading' | number
    viewModel.commentCounts = ko.observable({}); // { blockId: count }
    viewModel.initialUnresolvedCount = ko.observable(0); // Count loaded on init (before full comments load)
    viewModel.selectedBlockForComments = ko.observable(null);
    viewModel.selectedBlockSnapshot = ko.observable(null); // { id, index, type }
    viewModel.newCommentText = ko.observable('');
    viewModel.newCommentCategory = ko.observable('general');
    viewModel.newCommentSeverity = ko.observable('info');
    viewModel.replyingTo = ko.observable(null);
    viewModel.editingComment = ko.observable(null);
    viewModel.editCommentText = ko.observable('');

    // Mentions autocomplete
    viewModel.groupUsers = ko.observableArray([]);
    viewModel.mentionQuery = ko.observable('');
    viewModel.showMentionSuggestions = ko.observable(false);
    viewModel.mentionCursorPosition = ko.observable(0);
    viewModel.activeMentionTextarea = ko.observable(null);

    // Resolved comments expand/collapse
    viewModel.expandedResolvedIds = ko.observableArray([]);

    // Last selected block (preserved even when filter is cleared)
    viewModel.lastSelectedBlock = ko.observable(null);

    // ===== COMPUTED =====
    viewModel.unresolvedCommentCount = ko.computed(function () {
      // If comments are loaded, use the actual count
      if (viewModel.comments().length > 0 || viewModel.commentsStatus() !== false) {
        return viewModel.comments().filter(function (c) {
          return !c.resolved && !c._parentComment;
        }).length;
      }
      // Otherwise use the initial count loaded on init
      return viewModel.initialUnresolvedCount();
    });

    viewModel.filteredComments = ko.computed(function () {
      const blockId = viewModel.selectedBlockForComments();
      const allComments = viewModel.comments();

      var filtered;
      if (!blockId) {
        // Show all root comments
        filtered = allComments.filter(function (c) {
          return !c._parentComment;
        });
      } else {
        // Show comments for selected block
        filtered = allComments.filter(function (c) {
          return c.blockId === blockId && !c._parentComment;
        });
      }

      // Sort: unresolved first, then resolved
      return filtered.slice().sort(function (a, b) {
        if (a.resolved === b.resolved) return 0;
        return a.resolved ? 1 : -1;
      });
    });

    viewModel.getReplies = function (parentId) {
      return viewModel.comments().filter(function (c) {
        return c._parentComment === parentId;
      });
    };

    // Filtered mention suggestions based on query
    viewModel.mentionSuggestions = ko.computed(function () {
      const query = viewModel.mentionQuery().toLowerCase();
      if (!query) return [];
      return viewModel.groupUsers().filter(function (user) {
        return user.name && user.name.toLowerCase().indexOf(query) !== -1;
      }).slice(0, 5); // Limit to 5 suggestions
    });

    // Current block label for filter chip
    // Uses formatBlockName() to humanize the block type (e.g., "textimageBlock" -> "Text Image")
    viewModel.currentBlockLabel = ko.computed(function () {
      const blockId = viewModel.lastSelectedBlock();
      // When no block is selected, show "No block" text
      if (!blockId) {
        return viewModel.t('comments-no-block-selected') || 'Aucun bloc';
      }

      // Get block type and format it for display
      try {
        const blocks = viewModel.content().mainBlocks().blocks();
        for (var i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          const blockData = typeof block === 'function' ? block() : block;
          if (!blockData) continue;
          const id = typeof blockData.id === 'function' ? blockData.id() : blockData.id;
          if (id === blockId) {
            // Unwrap potential observables for block type
            let blockType = blockData._type || blockData.type;
            if (typeof blockType === 'function') blockType = blockType();
            if (typeof blockType === 'object' && blockType !== null) {
              blockType = blockType.name || blockType.label || 'Block';
            }
            blockType = blockType || 'Block';
            // Format the block name for human readability
            return formatBlockName(blockType);
          }
        }
      } catch (e) {
        // Fallback to block ID
      }

      return blockId;
    });

    // Block label for comment form context indicator
    // Shows which block the new comment will be attached to
    viewModel.commentFormBlockLabel = ko.computed(function () {
      const blockId = viewModel.selectedBlockForComments();
      if (!blockId) return null; // null means global comment

      // Get block type and format it for display
      try {
        const blocks = viewModel.content().mainBlocks().blocks();
        for (var i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          const blockData = typeof block === 'function' ? block() : block;
          if (!blockData) continue;
          const id = typeof blockData.id === 'function' ? blockData.id() : blockData.id;
          if (id === blockId) {
            let blockType = blockData._type || blockData.type;
            if (typeof blockType === 'function') blockType = blockType();
            if (typeof blockType === 'object' && blockType !== null) {
              blockType = blockType.name || blockType.label || 'Block';
            }
            blockType = blockType || 'Block';
            return formatBlockName(blockType);
          }
        }
      } catch (e) {
        // Fallback to block ID
      }

      return blockId;
    });

    /**
     * Clear block association for new comment (switch to global)
     */
    viewModel.clearBlockForComment = function () {
      viewModel.selectedBlockForComments(null);
      viewModel.selectedBlockSnapshot(null);
    };

    // ===== COMMENTS RAIL =====
    // Observable for rail marker positions (updated on scroll)
    viewModel.railMarkerPositions = ko.observable({});

    // Check if rail should be visible (only if there are block-specific comments)
    viewModel.commentsRailVisible = ko.computed(function () {
      const counts = viewModel.commentCounts();
      return Object.keys(counts).some(function (blockId) {
        // Skip global comments (no blockId)
        if (!blockId || blockId === 'null' || blockId === 'undefined') return false;

        const blockData = counts[blockId];
        // Handle both old format (number) and new format ({ count, maxSeverity })
        const count = typeof blockData === 'object' ? blockData.count : blockData;
        return count > 0;
      });
    });

    // Get blocks with comments for the rail display
    viewModel.blocksWithComments = ko.computed(function () {
      const counts = viewModel.commentCounts();
      const positions = viewModel.railMarkerPositions();
      const result = [];

      Object.keys(counts).forEach(function (blockId) {
        // Skip global comments (no blockId or null/undefined)
        if (!blockId || blockId === 'null' || blockId === 'undefined') return;

        const blockData = counts[blockId];
        // Handle both old format (number) and new format ({ count, maxSeverity })
        const count = typeof blockData === 'object' ? blockData.count : blockData;
        const maxSeverity = typeof blockData === 'object' ? blockData.maxSeverity : 'info';

        if (count <= 0) return;

        // Skip if position not available (block not in DOM or out of view)
        const posData = positions[blockId];
        if (!posData || !posData.visible) return;

        // Get block type for label (uses formatBlockName for humanization)
        let blockLabel = blockId;
        try {
          const blocks = viewModel.content().mainBlocks().blocks();
          for (var i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const blockInfo = typeof block === 'function' ? block() : block;
            if (!blockInfo) continue;
            const id = typeof blockInfo.id === 'function' ? blockInfo.id() : blockInfo.id;
            if (id === blockId) {
              // Unwrap potential observables for block type
              let blockType = blockInfo._type || blockInfo.type;
              if (typeof blockType === 'function') blockType = blockType();
              if (typeof blockType === 'object' && blockType !== null) {
                blockType = blockType.name || blockType.label || 'Block';
              }
              blockType = blockType || 'Block';
              // Format block name for human readability
              blockLabel = formatBlockName(blockType);
              break;
            }
          }
        } catch (e) {
          // Use blockId as fallback
        }

        result.push({
          blockId: blockId,
          position: posData.top,
          unresolvedCount: count,
          maxSeverity: maxSeverity,
          blockLabel: blockLabel,
        });
      });

      // Sort by position
      result.sort(function (a, b) {
        return a.position - b.position;
      });

      return result;
    });

    /**
     * Update rail marker positions based on block DOM positions
     * Called on scroll and when comments change
     * Returns position data with visibility info (markers scroll with blocks)
     */
    viewModel.updateRailPositions = function () {
      const counts = viewModel.commentCounts();
      const positions = {};
      const scrollContainer = document.querySelector('#main-wysiwyg-area');
      const topBarHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--top-bar-height') || '50', 10);

      if (!scrollContainer) return;

      const containerRect = scrollContainer.getBoundingClientRect();
      const viewportTop = topBarHeight;
      const viewportBottom = window.innerHeight - 60; // 60px for bottom toolbar
      const markerHeight = 28;

      Object.keys(counts).forEach(function (blockId) {
        // Skip global comments (no blockId)
        if (!blockId || blockId === 'null' || blockId === 'undefined') return;

        const blockData = counts[blockId];
        const count = typeof blockData === 'object' ? blockData.count : blockData;
        if (count <= 0) return;

        // Find the block element in the DOM
        const blockElement = scrollContainer.querySelector(
          '.editable[data-block-id="' + blockId + '"]'
        );

        if (blockElement) {
          const blockRect = blockElement.getBoundingClientRect();
          // Calculate position relative to viewport (center of block)
          const blockCenter = blockRect.top + (blockRect.height / 2) - topBarHeight;

          // Check if marker would be visible in the viewport
          const markerTop = blockCenter - (markerHeight / 2);
          const markerBottom = blockCenter + (markerHeight / 2);
          const isVisible = markerBottom > 0 && markerTop < (viewportBottom - viewportTop);

          positions[blockId] = {
            top: blockCenter,
            visible: isVisible,
          };
        }
      });

      viewModel.railMarkerPositions(positions);
    };

    /**
     * Highlight a block when hovering its rail marker
     * @param {string} blockId - ID of the block to highlight
     */
    viewModel.highlightBlockFromRail = function (blockId) {
      const scrollContainer = document.querySelector('#main-wysiwyg-area');
      if (!scrollContainer) return;

      const blockElement = scrollContainer.querySelector(
        '.editable[data-block-id="' + blockId + '"]'
      );

      if (blockElement) {
        blockElement.classList.add('comment-hover-highlight');
      }
    };

    /**
     * Remove highlight from all blocks
     */
    viewModel.unhighlightAllBlocks = function () {
      const highlightedBlocks = document.querySelectorAll('.comment-hover-highlight');
      highlightedBlocks.forEach(function (block) {
        block.classList.remove('comment-hover-highlight');
      });
    };

    // ===== METHODS =====

    /**
     * Load only the unresolved comments count (lightweight, called on init)
     */
    viewModel.loadUnresolvedCount = function () {
      $.ajax({
        url: apiBaseUrl + '/mailings/' + mailingId + '/comments/unresolved-count',
        method: 'GET',
        success: function (response) {
          viewModel.initialUnresolvedCount(response.count || 0);
        },
        error: function () {
          // Silently fail - not critical
          viewModel.initialUnresolvedCount(0);
        },
      });
    };

    /**
     * Load comments for the current mailing
     */
    viewModel.loadComments = function () {
      viewModel.commentsStatus('loading');

      $.ajax({
        url: apiBaseUrl + '/mailings/' + mailingId + '/comments',
        method: 'GET',
        success: function (response) {
          viewModel.comments(response.items || []);
          viewModel.commentsStatus(response.items ? response.items.length : 0);
          viewModel.loadCommentCounts();
        },
        error: function () {
          viewModel.commentsStatus(false);
          viewModel.notifier.error(viewModel.t('comments-load-error'));
        },
      });
    };

    /**
     * Load comment counts per block (for indicators)
     */
    viewModel.loadCommentCounts = function () {
      $.ajax({
        url: apiBaseUrl + '/mailings/' + mailingId + '/comments/counts',
        method: 'GET',
        success: function (response) {
          viewModel.commentCounts(response.counts || {});
        },
      });
    };

    /**
     * Load group users for mentions autocomplete
     */
    viewModel.loadGroupUsers = function () {
      if (viewModel.groupUsers().length > 0) return; // Already loaded

      $.ajax({
        url: apiBaseUrl + '/groups/' + groupId + '/users',
        method: 'GET',
        success: function (response) {
          const users = response.items || response || [];
          viewModel.groupUsers(users);
        },
      });
    };

    /**
     * Handle textarea input for mention detection
     */
    viewModel.handleCommentInput = function (data, event) {
      const textarea = event.target;
      const text = textarea.value;
      const cursorPos = textarea.selectionStart;

      // Find @ symbol before cursor
      const textBeforeCursor = text.substring(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf('@');

      if (atIndex !== -1) {
        const textAfterAt = textBeforeCursor.substring(atIndex + 1);
        // Check if we're in the middle of typing a mention (no space after @)
        if (!/\s/.test(textAfterAt)) {
          viewModel.mentionQuery(textAfterAt);
          viewModel.mentionCursorPosition(cursorPos);
          viewModel.activeMentionTextarea(textarea);
          viewModel.showMentionSuggestions(true);
          return true;
        }
      }

      viewModel.showMentionSuggestions(false);
      viewModel.mentionQuery('');
      return true;
    };

    /**
     * Insert a mention into the textarea
     */
    viewModel.insertMention = function (user) {
      const textarea = viewModel.activeMentionTextarea();
      if (!textarea) return;

      const text = textarea.value;
      const cursorPos = viewModel.mentionCursorPosition();
      const textBeforeCursor = text.substring(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf('@');

      if (atIndex !== -1) {
        const textBefore = text.substring(0, atIndex);
        const textAfter = text.substring(cursorPos);
        const userId = user._id || user.id;
        const mention = '@[' + user.name + '](' + userId + ') ';
        const newText = textBefore + mention + textAfter;

        // Update the appropriate observable
        if (textarea.classList.contains('comment-textarea-main')) {
          viewModel.newCommentText(newText);
        } else if (textarea.classList.contains('comment-textarea-edit')) {
          viewModel.editCommentText(newText);
        } else {
          viewModel.newCommentText(newText);
        }

        // Set cursor position after mention
        setTimeout(function () {
          const newPos = textBefore.length + mention.length;
          textarea.setSelectionRange(newPos, newPos);
          textarea.focus();
        }, 0);
      }

      viewModel.showMentionSuggestions(false);
      viewModel.mentionQuery('');
    };

    /**
     * Hide mention suggestions
     */
    viewModel.hideMentionSuggestions = function () {
      viewModel.showMentionSuggestions(false);
      viewModel.mentionQuery('');
    };

    /**
     * Extract mention user IDs from text
     * Format: @[User Name](userId)
     */
    viewModel.extractMentions = function (text) {
      const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9]+)\)/g;
      const mentions = [];
      let match;
      while ((match = mentionRegex.exec(text)) !== null) {
        mentions.push(match[2]); // User ID
      }
      return mentions;
    };

    /**
     * Toggle expand/collapse on a resolved comment
     */
    viewModel.toggleResolvedComment = function (comment, event) {
      if (!comment.resolved) return true; // Only for resolved
      var id = comment._id;
      if (viewModel.expandedResolvedIds.indexOf(id) >= 0) {
        viewModel.expandedResolvedIds.remove(id);
      } else {
        viewModel.expandedResolvedIds.push(id);
      }
    };
    viewModel.isResolvedExpanded = function (commentId) {
      return viewModel.expandedResolvedIds.indexOf(commentId) >= 0;
    };

    /**
     * Create a new comment
     */
    viewModel.createComment = function () {
      const text = viewModel.newCommentText().trim();
      if (!text) {
        viewModel.notifier.error(viewModel.t('comments-text-required'));
        return;
      }

      // Extract mentions from text
      const mentions = viewModel.extractMentions(text);

      const blockSnapshot = viewModel.selectedBlockSnapshot();
      const data = {
        text: text,
        category: viewModel.newCommentCategory(),
        severity: viewModel.newCommentSeverity(),
        blockId: viewModel.selectedBlockForComments() || null,
        blockSnapshot: blockSnapshot
          ? {
              index: blockSnapshot.index,
              type: blockSnapshot.type,
            }
          : null,
        mentions: mentions,
      };

      // If replying to a comment
      if (viewModel.replyingTo()) {
        data.parentCommentId = viewModel.replyingTo()._id;
      }

      $.ajax({
        url: apiBaseUrl + '/mailings/' + mailingId + '/comments',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function (comment) {
          viewModel.comments.push(comment);
          viewModel.newCommentText('');
          viewModel.replyingTo(null);
          viewModel.loadCommentCounts();
          viewModel.notifier.success(viewModel.t('comments-created'));
        },
        error: function () {
          viewModel.notifier.error(viewModel.t('comments-create-error'));
        },
      });
    };

    /**
     * Start editing a comment
     */
    viewModel.startEditComment = function (comment) {
      viewModel.editingComment(comment);
      viewModel.editCommentText(comment.text);
    };

    /**
     * Cancel editing
     */
    viewModel.cancelEditComment = function () {
      viewModel.editingComment(null);
      viewModel.editCommentText('');
    };

    /**
     * Save edited comment
     */
    viewModel.saveEditComment = function () {
      const comment = viewModel.editingComment();
      if (!comment) return;

      const text = viewModel.editCommentText().trim();
      if (!text) {
        viewModel.notifier.error(viewModel.t('comments-text-required'));
        return;
      }

      $.ajax({
        url: apiBaseUrl + '/comments/' + comment._id,
        method: 'PATCH',
        contentType: 'application/json',
        data: JSON.stringify({ text: text }),
        success: function (updatedComment) {
          // Update in array
          const comments = viewModel.comments();
          const index = comments.findIndex(function (c) {
            return c._id === updatedComment._id;
          });
          if (index >= 0) {
            comments[index] = updatedComment;
            viewModel.comments(comments);
          }
          viewModel.cancelEditComment();
          viewModel.notifier.success(viewModel.t('comments-updated'));
        },
        error: function () {
          viewModel.notifier.error(viewModel.t('comments-update-error'));
        },
      });
    };

    /**
     * Delete a comment
     */
    viewModel.deleteComment = function (comment) {
      if (!confirm(viewModel.t('comments-delete-confirm'))) {
        return;
      }

      $.ajax({
        url: apiBaseUrl + '/comments/' + comment._id,
        method: 'DELETE',
        success: function () {
          // Remove from array (and its replies)
          const comments = viewModel.comments().filter(function (c) {
            return c._id !== comment._id && c._parentComment !== comment._id;
          });
          viewModel.comments(comments);
          viewModel.loadCommentCounts();
          viewModel.notifier.success(viewModel.t('comments-deleted'));
        },
        error: function () {
          viewModel.notifier.error(viewModel.t('comments-delete-error'));
        },
      });
    };

    /**
     * Resolve a comment
     */
    viewModel.resolveComment = function (comment) {
      $.ajax({
        url: apiBaseUrl + '/comments/' + comment._id + '/resolve',
        method: 'PATCH',
        success: function (updatedComment) {
          const comments = viewModel.comments();
          const index = comments.findIndex(function (c) {
            return c._id === updatedComment._id;
          });
          if (index >= 0) {
            comments[index] = updatedComment;
            viewModel.comments(comments);
          }
          viewModel.loadCommentCounts();
          viewModel.notifier.success(viewModel.t('comments-resolved'));
        },
        error: function () {
          viewModel.notifier.error(viewModel.t('comments-resolve-error'));
        },
      });
    };

    /**
     * Unresolve (reopen) a comment
     */
    viewModel.unresolveComment = function (comment) {
      $.ajax({
        url: apiBaseUrl + '/comments/' + comment._id + '/unresolve',
        method: 'PATCH',
        success: function (updatedComment) {
          const comments = viewModel.comments();
          const index = comments.findIndex(function (c) {
            return c._id === updatedComment._id;
          });
          if (index >= 0) {
            comments[index] = updatedComment;
            viewModel.comments(comments);
          }
          viewModel.loadCommentCounts();
          viewModel.notifier.success(viewModel.t('comments-unresolved'));
        },
        error: function () {
          viewModel.notifier.error(viewModel.t('comments-unresolve-error'));
        },
      });
    };

    /**
     * Start replying to a comment
     */
    viewModel.startReply = function (comment) {
      viewModel.replyingTo(comment);
      viewModel.newCommentText('');
      // Focus on reply textarea after DOM update
      setTimeout(function () {
        var replyTextarea = document.querySelector('.comment-textarea-reply');
        if (replyTextarea) replyTextarea.focus();
      }, 50);
    };

    /**
     * Cancel reply
     */
    viewModel.cancelReply = function () {
      viewModel.replyingTo(null);
    };

    /**
     * Toggle comments panel
     */
    viewModel.toggleComments = function () {
      var wasHidden = !viewModel.showComments();
      viewModel.showComments(!viewModel.showComments());
      // Focus on main textarea when opening panel
      if (wasHidden) {
        setTimeout(function () {
          var mainTextarea = document.querySelector('.comment-textarea-main');
          if (mainTextarea) mainTextarea.focus();
        }, 50);
      }
    };

    /**
     * Open comments for a specific block
     */
    viewModel.openCommentsForBlock = function (blockId) {
      viewModel.selectedBlockForComments(blockId);
      viewModel.lastSelectedBlock(blockId); // Remember for filter chip
      viewModel.showComments(true);
      // Focus on main textarea after DOM update
      setTimeout(function () {
        var mainTextarea = document.querySelector('.comment-textarea-main');
        if (mainTextarea) mainTextarea.focus();
      }, 50);
    };

    /**
     * Comment block - called from block toolbar
     * @param {Object} blockData - The raw block data ($rawData)
     * @param {Object} parent - The parent container
     * @param {number|function} index - The block index ($index)
     */
    viewModel.commentBlock = function (blockData, parent, index) {
      // Unwrap observables
      const unwrappedBlock = ko.toJS(blockData);
      const blockId = unwrappedBlock.id || null;
      const blockIndex = ko.utils.unwrapObservable(index);
      const blockType = unwrappedBlock._type || unwrappedBlock.type || 'unknown';

      // Store block snapshot for context
      viewModel.selectedBlockSnapshot({
        id: blockId,
        index: blockIndex,
        type: blockType,
      });

      // Open comments panel filtered to this block
      viewModel.selectedBlockForComments(blockId);
      viewModel.lastSelectedBlock(blockId); // Remember for filter chip
      viewModel.showComments(true);

      // Load comments if not already loaded
      if (viewModel.commentsStatus() === false) {
        viewModel.loadComments();
      }
    };

    /**
     * Clear block filter
     */
    viewModel.showAllComments = function () {
      viewModel.selectedBlockForComments(null);
    };

    /**
     * Filter comments to the last selected block
     */
    viewModel.filterToCurrentBlock = function () {
      const blockId = viewModel.lastSelectedBlock();
      if (blockId) {
        viewModel.selectedBlockForComments(blockId);
      }
    };

    /**
     * Get comment count for a block (for indicators)
     */
    viewModel.getBlockCommentCount = function (blockId) {
      const counts = viewModel.commentCounts();
      const blockData = counts[blockId];
      if (!blockData) return 0;
      // Handle both old format (number) and new format ({ count, maxSeverity })
      return typeof blockData === 'object' ? blockData.count : blockData;
    };

    /**
     * Check if current user is author of comment
     */
    viewModel.isCommentAuthor = function (comment) {
      const currentUser = viewModel.currentUser();
      if (!currentUser || !comment._author) return false;
      // Use .id (not ._id) because mongoose-hidden hides _id from User JSON
      const authorId =
        typeof comment._author === 'object'
          ? comment._author.id || comment._author._id
          : comment._author;
      const currentUserId = currentUser.id || currentUser._id;
      return currentUserId === authorId;
    };

    /**
     * Check if current user can delete comment (author or admin)
     */
    viewModel.canDeleteComment = function (comment) {
      const currentUser = viewModel.currentUser();
      if (!currentUser) return false;
      if (viewModel.isCommentAuthor(comment)) return true;
      return currentUser.isAdminOfCurrentGroup;
    };

    /**
     * Format date for display (relative format)
     */
    viewModel.formatCommentDate = function (dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) {
        return viewModel.t('comments-date-now');
      } else if (diffMins < 60) {
        return diffMins + ' min';
      } else if (diffHours < 24) {
        return diffHours + 'h';
      } else if (diffDays < 7) {
        return diffDays + 'j';
      } else {
        // Format: "12 jan." or "12 jan. 2025"
        const months = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        const currentYear = now.getFullYear();
        if (year === currentYear) {
          return day + ' ' + month;
        }
        return day + ' ' + month + ' ' + year;
      }
    };

    /**
     * Get severity CSS class
     */
    viewModel.getSeverityClass = function (severity) {
      return 'comment-severity-' + (severity || 'info');
    };

    /**
     * Get category label
     */
    viewModel.getCategoryLabel = function (category) {
      return viewModel.t('comments-category-' + (category || 'general'));
    };

    /**
     * Escape HTML to prevent XSS
     */
    viewModel.escapeHtml = function (text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    /**
     * Format comment text with styled mentions
     * Converts @[Name](userId) to <span class="mention">@Name</span>
     */
    viewModel.formatCommentText = function (text) {
      if (!text) return '';

      // First escape HTML
      let escaped = viewModel.escapeHtml(text);

      // Then replace mention patterns with styled spans
      const mentionRegex = /@\[([^\]]+)\]\([a-f0-9]+\)/g;
      escaped = escaped.replace(mentionRegex, '<span class="comment-mention">@$1</span>');

      // Convert newlines to <br>
      escaped = escaped.replace(/\n/g, '<br>');

      return escaped;
    };

    /**
     * Check if a block still exists in the mailing
     */
    viewModel.blockExists = function (blockId) {
      if (!blockId) return true; // Mailing-level comments always valid

      try {
        const blocks = viewModel.content().mainBlocks().blocks();
        return blocks.some(function (block) {
          // Each block is an observable function, need to call it
          const blockData = typeof block === 'function' ? block() : block;
          if (!blockData) return false;
          // The id property may also be an observable
          const id = typeof blockData.id === 'function' ? blockData.id() : blockData.id;
          return id === blockId;
        });
      } catch (e) {
        return true; // Assume exists if we can't check
      }
    };

    /**
     * Get block info display text
     */
    viewModel.getBlockInfoText = function (comment) {
      if (!comment.blockId) {
        return null; // Mailing-level comment
      }

      if (viewModel.blockExists(comment.blockId)) {
        return comment.blockId;
      }

      // Block was deleted - show info from snapshot if available
      if (comment.blockSnapshot && comment.blockSnapshot.type) {
        return viewModel.t('comments-block-deleted') + ' (' + comment.blockSnapshot.type + ')';
      }

      return viewModel.t('comments-block-deleted');
    };

    /**
     * Find a block object by its ID
     */
    viewModel.findBlockById = function (blockId) {
      if (!blockId) return null;

      try {
        const blocks = viewModel.content().mainBlocks().blocks();
        for (var i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          // Each block is an observable function, need to call it
          const blockData = typeof block === 'function' ? block() : block;
          if (!blockData) continue;
          // The id property may also be an observable
          const id = typeof blockData.id === 'function' ? blockData.id() : blockData.id;
          if (id === blockId) {
            return blockData;
          }
        }
      } catch (e) {
        console.warn('Could not find block:', e);
      }
      return null;
    };

    /**
     * Navigate to a comment's block in the editor
     * Selects the block and scrolls to it
     */
    viewModel.goToCommentBlock = function (comment) {
      if (!comment.blockId) {
        viewModel.notifier.info(viewModel.t('comments-no-block'));
        return;
      }

      if (!viewModel.blockExists(comment.blockId)) {
        viewModel.notifier.warning(viewModel.t('comments-block-deleted'));
        return;
      }

      const block = viewModel.findBlockById(comment.blockId);
      if (!block) {
        return;
      }

      // Select the block
      viewModel.selectBlock(block, true);

      // Scroll to the block element in the DOM
      setTimeout(function () {
        const blockElement = document.querySelector(
          '.editable[data-block-id="' + comment.blockId + '"]'
        );

        if (blockElement) {
          blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a brief highlight effect
          blockElement.classList.add('comment-highlight');
          setTimeout(function () {
            blockElement.classList.remove('comment-highlight');
          }, 2000);
        }
      }, 100);
    };

    // ===== SUBSCRIPTIONS =====

    // Load comments and users when panel opens for the first time
    const commentsOpenSub = viewModel.showComments.subscribe(function (isOpen) {
      if (isOpen && viewModel.commentsStatus() === false) {
        viewModel.loadComments();
        viewModel.loadGroupUsers();
        commentsOpenSub.dispose();
      }
    });

    // Update rail positions when comment counts change
    viewModel.commentCounts.subscribe(function () {
      setTimeout(viewModel.updateRailPositions, 100);
    });

    // Setup scroll listener for rail position updates
    setTimeout(function () {
      const scrollContainer = document.querySelector('#main-wysiwyg-area');
      if (scrollContainer) {
        let scrollTimeout;
        scrollContainer.addEventListener('scroll', function () {
          // Throttle scroll updates
          if (scrollTimeout) return;
          scrollTimeout = setTimeout(function () {
            scrollTimeout = null;
            viewModel.updateRailPositions();
          }, 16); // ~60fps
        });

        // Initial position update
        viewModel.updateRailPositions();
      }
    }, 500);

    // Subscribe to selected block changes to update lastSelectedBlock
    // When a block is deselected, reset to "All" filter
    viewModel.selectedBlock.subscribe(function (block) {
      if (block) {
        // Get block ID - handle observable or direct value
        const blockId = typeof block.id === 'function' ? block.id() : block.id;
        if (blockId) {
          viewModel.lastSelectedBlock(blockId);

          // If comments panel is open, also set the block for new comments
          // This enables the "click on block to associate comment" UX
          if (viewModel.showComments()) {
            viewModel.selectedBlockForComments(blockId);

            // Update block snapshot for context
            try {
              const blocks = viewModel.content().mainBlocks().blocks();
              for (var i = 0; i < blocks.length; i++) {
                const b = blocks[i];
                const blockData = typeof b === 'function' ? b() : b;
                if (!blockData) continue;
                const id = typeof blockData.id === 'function' ? blockData.id() : blockData.id;
                if (id === blockId) {
                  let blockType = blockData._type || blockData.type;
                  if (typeof blockType === 'function') blockType = blockType();
                  if (typeof blockType === 'object' && blockType !== null) {
                    blockType = blockType.name || blockType.label || 'unknown';
                  }
                  viewModel.selectedBlockSnapshot({
                    id: blockId,
                    index: i,
                    type: blockType || 'unknown',
                  });
                  break;
                }
              }
            } catch (e) {
              // Fallback - just set the ID
              viewModel.selectedBlockSnapshot({ id: blockId, index: null, type: 'unknown' });
            }
          }
        }
      } else {
        // Block was deselected - reset to "All" filter
        viewModel.lastSelectedBlock(null);
        viewModel.selectedBlockForComments(null);
      }
    });

    // Check URL parameter to auto-open comments panel
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('comments') === '1') {
        // Delay to ensure the editor is fully loaded
        setTimeout(function () {
          viewModel.showComments(true);
          viewModel.loadComments();
          viewModel.loadGroupUsers();
        }, 500);
      }
    } catch (e) {
      // URLSearchParams not supported or other error
    }

    // Load unresolved count on init (for floating indicator)
    viewModel.loadUnresolvedCount();

    // Load comment counts per block on init (for rail indicators)
    viewModel.loadCommentCounts();

    console.info('Comments extension initialized');
  };
}

module.exports = commentsLoader;
