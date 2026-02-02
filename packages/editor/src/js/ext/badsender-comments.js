'use strict';

const $ = require('jquery');
const ko = require('knockout');

/**
 * Comments extension for the Mosaico editor
 * Adds collaborative commenting functionality on blocks
 */
function commentsLoader(opts) {
  const mailingId = opts.metadata.id;
  const apiBaseUrl = '/api';

  return function (viewModel) {
    // ===== OBSERVABLES =====
    viewModel.showComments = ko.observable(false);
    viewModel.comments = ko.observableArray([]);
    viewModel.commentsStatus = ko.observable(false); // false | 'loading' | number
    viewModel.commentCounts = ko.observable({}); // { blockId: count }
    viewModel.selectedBlockForComments = ko.observable(null);
    viewModel.newCommentText = ko.observable('');
    viewModel.newCommentCategory = ko.observable('general');
    viewModel.newCommentSeverity = ko.observable('info');
    viewModel.replyingTo = ko.observable(null);
    viewModel.editingComment = ko.observable(null);
    viewModel.editCommentText = ko.observable('');

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
     * Create a new comment
     */
    viewModel.createComment = function () {
      const text = viewModel.newCommentText().trim();
      if (!text) {
        viewModel.notifier.error(viewModel.t('comments-text-required'));
        return;
      }

      const data = {
        text: text,
        category: viewModel.newCommentCategory(),
        severity: viewModel.newCommentSeverity(),
        blockId: viewModel.selectedBlockForComments() || null,
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
     * Format date for display
     */
    viewModel.formatCommentDate = function (dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
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

    // ===== SUBSCRIPTIONS =====

    // Load comments when panel opens for the first time
    const commentsOpenSub = viewModel.showComments.subscribe(function (isOpen) {
      if (isOpen && viewModel.commentsStatus() === false) {
        viewModel.loadComments();
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

    console.info('Comments extension initialized');
  };
}

module.exports = commentsLoader;
