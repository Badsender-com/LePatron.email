'use strict';

const $ = require('jquery');
const ko = require('knockout');

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

    // ===== COMPUTED =====
    viewModel.unresolvedCommentCount = ko.computed(function () {
      return viewModel.comments().filter(function (c) {
        return !c.resolved && !c._parentComment;
      }).length;
    });

    viewModel.filteredComments = ko.computed(function () {
      const blockId = viewModel.selectedBlockForComments();
      const allComments = viewModel.comments();

      if (!blockId) {
        // Show all root comments
        return allComments.filter(function (c) {
          return !c._parentComment;
        });
      }

      // Show comments for selected block
      return allComments.filter(function (c) {
        return c.blockId === blockId && !c._parentComment;
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

    // ===== METHODS =====

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
     * Start replying to a comment
     */
    viewModel.startReply = function (comment) {
      viewModel.replyingTo(comment);
      viewModel.newCommentText('');
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
      viewModel.showComments(!viewModel.showComments());
    };

    /**
     * Open comments for a specific block
     */
    viewModel.openCommentsForBlock = function (blockId) {
      viewModel.selectedBlockForComments(blockId);
      viewModel.showComments(true);
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
     * Get comment count for a block (for indicators)
     */
    viewModel.getBlockCommentCount = function (blockId) {
      const counts = viewModel.commentCounts();
      return counts[blockId] || 0;
    };

    /**
     * Check if current user is author of comment
     */
    viewModel.isCommentAuthor = function (comment) {
      const currentUser = viewModel.currentUser();
      if (!currentUser || !comment._author) return false;
      const authorId =
        typeof comment._author === 'object'
          ? comment._author._id
          : comment._author;
      return currentUser._id === authorId || currentUser.id === authorId;
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
          '[data-ko-block][id="' + comment.blockId + '"], ' +
          '.editable[id="' + comment.blockId + '"]'
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

    // Also subscribe to selected block changes to update filter
    viewModel.selectedBlock.subscribe(function (block) {
      if (block && viewModel.showComments()) {
        // Optionally auto-filter to selected block
        // viewModel.selectedBlockForComments(block.id);
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

    console.info('Comments extension initialized');
  };
}

module.exports = commentsLoader;
