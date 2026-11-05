'use strict';

const $ = require('jquery');
const ko = require('knockout');
const { userCan } = require('./user-can.js');
const { CAPABILITIES } = require('../../../../shared/access/roles.js');

// Import utility functions
const {
  formatBlockName,
  getBlockType,
  getBlockLabelWithNumber,
  formatCommentDate,
  escapeHtml,
  formatCommentText,
  findMentionContext,
  reconstructMentionsForStorage,
  extractMentionIds,
} = require('./comments-utils.js');
const { findBlockById, goToBlock } = require('./block-navigation.js');
const { installRightPanel } = require('./right-panel.js');
const { createCommentsRail } = require('./comments/comments-rail.js');
const { createCommentsStore } = require('./comments/comments-store.js');
const { createCommentsApi } = require('./comments/comments-api.js');

/**
 * Comments extension for the Mosaico editor
 * Adds collaborative commenting functionality on blocks
 */
// What the user is told when the server refuses a new comment: an approval
// over an open blocking comment, or by someone who may not approve, says why.
const CREATE_ERROR_KEYS = {
  COMMENT_APPROVAL_BLOCKED: 'comments-approve-blocked',
  COMMENT_APPROVAL_FORBIDDEN: 'comments-approve-forbidden',
};

function createErrorKey(xhr) {
  const code = xhr && xhr.responseJSON && xhr.responseJSON.message;
  return CREATE_ERROR_KEYS[code] || 'comments-create-error';
}

function commentsLoader(opts) {
  const mailingId = opts.metadata.id;
  const groupId = opts.metadata.groupId;
  const apiBaseUrl = '/api';
  const mailingCommentsUrl = apiBaseUrl + '/mailings/' + mailingId + '/comments';

  return function (viewModel) {
    // ===== OBSERVABLES =====
    // One of the right panels: opening it closes quality control or the AI
    // panel (ADR 0010).
    viewModel.showComments = installRightPanel(viewModel, ko).flag('comments');
    // The comments' state lives in a store the panel and the canvas pieces
    // share (ADR 0020); these names stay for the Knockout panel until it moves
    // to Vue.
    const store = createCommentsStore(ko, {
      api: createCommentsApi({ apiBaseUrl, mailingId }),
      isOpen: viewModel.showComments,
      selection: viewModel.selectedBlock,
    });
    viewModel.commentsStore = store;
    viewModel.comments = store.comments;
    viewModel.commentsStatus = store.status;
    viewModel.commentCounts = store.counts;
    // The filter of the list only reads; the target of a new comment is apart.
    viewModel.selectedBlockForComments = store.filter;
    viewModel.commentTarget = store.target;
    viewModel.newCommentText = store.draftText;
    viewModel.newCommentCategory = store.draftCategory;
    viewModel.newCommentSeverity = store.draftSeverity;
    // A draft the quality control must not take the panel from.
    viewModel.hasCommentDraft = function () {
      return viewModel.showComments() && store.hasDraft();
    };
    viewModel.replyingTo = ko.observable(null);
    viewModel.editingComment = ko.observable(null);
    viewModel.editCommentText = ko.observable('');
    viewModel.isCommentTextareaFocused = ko.observable(false);

    // Mentions autocomplete
    viewModel.groupUsers = ko.observableArray([]);
    viewModel.mentionQuery = ko.observable('');
    viewModel.showMentionSuggestions = ko.observable(false);
    viewModel.mentionCursorPosition = ko.observable(0);
    viewModel.activeMentionTextarea = ko.observable(null);
    // Track inserted mentions: [{ name, userId, displayText }]
    // displayText is "@Name" as shown in textarea
    viewModel.trackedMentions = ko.observableArray([]);

    // Resolved comments expand/collapse
    viewModel.expandedResolvedIds = ko.observableArray([]);

    // Last selected block (preserved even when filter is cleared)
    viewModel.lastSelectedBlock = ko.observable(null);

    // ===== COMPUTED =====
    // Never a reply nor an approval, as the server counts them (ADR 0020).
    viewModel.unresolvedCommentCount = store.unresolvedCount;

    // A blocking comment open keeps the email from being approved: the server
    // refuses it too (ADR 0020). Root comments only, never an approval.
    viewModel.hasOpenBlocking = ko.computed(function () {
      // Held behind the pill included: the server counts them too.
      return store.allComments().some(function (c) {
        return (
          !c.resolved &&
          !c._parentComment &&
          c.severity === 'blocking' &&
          c.decision !== 'approved'
        );
      });
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
    // Shows all users (up to 5) when @ is typed, then filters as user types
    viewModel.mentionSuggestions = ko.computed(function () {
      const query = viewModel.mentionQuery().toLowerCase();
      const users = viewModel.groupUsers();
      if (!query) {
        // Show first 5 users when @ is typed without any filter
        return users.slice(0, 5);
      }
      return users.filter(function (user) {
        return user.name && user.name.toLowerCase().indexOf(query) !== -1;
      }).slice(0, 5);
    });

    // Current block label for filter chip
    // Shows human-readable block name with numbering for duplicates
    viewModel.currentBlockLabel = ko.computed(function () {
      // The block the list is filtered on, else the one last selected.
      const blockId = store.filter() || viewModel.lastSelectedBlock();
      // When no block is selected, show "No block" text
      if (!blockId) {
        return viewModel.t('comments-no-block-selected') || 'Aucun bloc';
      }

      try {
        const blocks = viewModel.content().mainBlocks().blocks();
        const label = getBlockLabelWithNumber(blocks, blockId);
        return label || blockId;
      } catch (e) {
        return blockId;
      }
    });

    // Block label for comment form context indicator
    // Shows which block the new comment will be attached to
    viewModel.commentFormBlockLabel = ko.computed(function () {
      const blockId = store.target();
      if (!blockId) return null; // null means global comment

      try {
        const blocks = viewModel.content().mainBlocks().blocks();
        const label = getBlockLabelWithNumber(blocks, blockId);
        return label || blockId;
      } catch (e) {
        return blockId;
      }
    });

    /**
     * Clear block association for new comment (switch to global)
     */
    viewModel.clearBlockForComment = function () {
      store.setTarget(null);
    };

    // ===== COMMENTS RAIL =====
    // The comment markers beside the email (ADR 0020): a module of its own,
    // which stays in Knockout when the panel moves to Vue.
    const labelOfBlock = function (blockId) {
      const block = findBlockById(viewModel, blockId);
      // A block outside the lists (the header, the footer): its type is in
      // its id, ko_<type>_<n>.
      if (!block) {
        const match = /^ko_(.+)_\d+$/.exec(blockId);
        return match ? formatBlockName(match[1]) : blockId;
      }
      let blockType = ko.unwrap(block._type || block.type);
      if (typeof blockType === 'object' && blockType !== null) {
        blockType = blockType.name || blockType.label;
      }
      return formatBlockName(blockType || 'Block');
    };
    const rail = createCommentsRail(ko, {
      counts: viewModel.commentCounts,
      // The active marker is the target's (ADR 0020, decision 7b).
      target: store.target,
      openForBlock: function (blockId) {
        viewModel.openCommentsForBlock(blockId);
      },
      labelOf: labelOfBlock,
      scroller: function () {
        return document.querySelector('#main-wysiwyg-area');
      },
    });
    viewModel.commentsRail = rail;

    /**
// ===== METHODS =====

    /**
     * The list, as at an opening; the counters follow it once loaded.
     */
    viewModel.loadComments = function () {
      return store.load().catch(function () {
        viewModel.notifier.error(viewModel.t('comments-load-error'));
      });
    };

    /**
     * The counters before the list loads; afterwards they come from it.
     */
    viewModel.loadCommentCounts = function () {
      if (viewModel.commentsStatus() === false) store.start();
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

      // Use utility to find mention context
      const mentionContext = findMentionContext(text, cursorPos);

      if (mentionContext) {
        viewModel.mentionQuery(mentionContext.query);
        viewModel.mentionCursorPosition(cursorPos);
        viewModel.activeMentionTextarea(textarea);
        viewModel.showMentionSuggestions(true);
        return true;
      }

      viewModel.showMentionSuggestions(false);
      viewModel.mentionQuery('');
      return true;
    };

    /**
     * Insert a mention into the textarea
     * Displays "@Name" in textarea but tracks the full mention data for submission
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
        // Display format: just "@Name " (user-friendly)
        const displayMention = '@' + user.name + ' ';
        const newText = textBefore + displayMention + textAfter;

        // Track this mention for later reconstruction
        viewModel.trackedMentions.push({
          name: user.name,
          userId: userId,
          displayText: '@' + user.name  // Without trailing space for matching
        });

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
          const newPos = textBefore.length + displayMention.length;
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
     * Handle textarea focus - expand textarea
     */
    viewModel.onTextareaFocus = function () {
      viewModel.isCommentTextareaFocused(true);
      return true; // Allow default behavior
    };

    /**
     * Handle textarea blur - collapse textarea (with delay for mentions)
     */
    viewModel.onTextareaBlur = function () {
      setTimeout(function () {
        viewModel.hideMentionSuggestions();
        // Only collapse if textarea is empty
        if (!viewModel.newCommentText().trim()) {
          viewModel.isCommentTextareaFocused(false);
        }
      }, 200);
      return true; // Allow default behavior
    };

    /**
     * Reconstruct text with full mention format for storage
     * Uses utility function with tracked mentions
     */
    viewModel.reconstructTextForStorage = function (text) {
      return reconstructMentionsForStorage(text, viewModel.trackedMentions());
    };

    /**
     * Extract mention user IDs from tracked mentions that are still in the text
     * Uses utility function with tracked mentions
     */
    viewModel.extractMentions = function (text) {
      return extractMentionIds(text, viewModel.trackedMentions());
    };

    /**
     * Clear tracked mentions (after submit or cancel)
     */
    viewModel.clearTrackedMentions = function () {
      viewModel.trackedMentions.removeAll();
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
    viewModel.createComment = function (decision) {
      let text = viewModel.newCommentText().trim();
      if (!text) {
        // Approving doesn't require a written comment — fall back to a
        // default message instead of blocking the action.
        if (decision === 'approved') {
          text = viewModel.t('comments-decision-approve-default-text');
        } else {
          viewModel.notifier.error(viewModel.t('comments-text-required'));
          return;
        }
      }

      // Extract mentions from text (uses tracked mentions)
      const mentions = viewModel.extractMentions(text);

      // Reconstruct full mention format for storage
      const textForStorage = viewModel.reconstructTextForStorage(text);

      // The server takes the block's place from the email as saved.
      const parent = viewModel.replyingTo();
      const data = {
        text: textForStorage,
        category: viewModel.newCommentCategory(),
        severity: viewModel.newCommentSeverity(),
        decision: typeof decision === 'string' ? decision : null,
        // A reply is on its comment's block; a new comment on its target.
        blockId: parent ? parent.blockId || null : store.target(),
        mentions: mentions,
      };

      // If replying to a comment
      if (parent) {
        data.parentCommentId = parent._id;
      }

      $.ajax({
        url: mailingCommentsUrl,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function (comment) {
          store.upsert(comment);
          store.clearDraft();
          // The next comment follows the selection again.
          if (!parent) store.followSelection();
          viewModel.replyingTo(null);
          viewModel.clearTrackedMentions();
          viewModel.loadCommentCounts();
          viewModel.notifier.success(viewModel.t('comments-created'));
        },
        error: function (xhr) {
          viewModel.notifier.error(viewModel.t(createErrorKey(xhr)));
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
          store.upsert(updatedComment);
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
          store.remove(comment._id);
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
          store.upsert(updatedComment);
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
          store.upsert(updatedComment);
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
      // The comments of the block, read and written on.
      viewModel.selectedBlockForComments(blockId);
      store.setTarget(blockId);
      viewModel.lastSelectedBlock(blockId); // Remember for filter chip
      viewModel.showComments(true);

      // Select the block in the editor (same as "Go to block")
      goToBlock(viewModel, blockId);

      // Focus on main textarea after DOM update
      setTimeout(function () {
        var mainTextarea = document.querySelector('.comment-textarea-main');
        if (mainTextarea) mainTextarea.focus();
      }, 150);
    };

    /**
     * Start a comment from a quality control finding (the quality drawer's
     * "Add comment"): the comments panel opens on the finding's block, or on
     * the whole email for a finding with no block, with the form filled in.
     * Nothing is posted: the user reviews it and sends it themselves.
     * @param {{ blockId: ?string, text: string, severity: string, category: string }} draft
     *   severity and category in the comment's own terms (blocking/important/info,
     *   design/content/general)
     */
    viewModel.createCommentFromQc = function (draft) {
      viewModel.replyingTo(null);
      // A block deleted since the check: the comment is about the whole email.
      const blockId =
        draft.blockId && findBlockById(viewModel, draft.blockId)
          ? draft.blockId
          : null;
      // The finding's block is the target, the filter is left alone; a
      // comment being written is kept, the finding follows it.
      store.draftFromQuality({
        blockId: blockId,
        text: draft.text,
        severity: draft.severity,
        category: draft.category,
      });
      viewModel.showComments(true);
      if (blockId) goToBlock(viewModel, blockId);
    };

    /**
     * Comment block - called from block toolbar
     * @param {Object} blockData - The raw block data ($rawData)
     * @param {Object} parent - The parent container
     * @param {number|function} index - The block index ($index)
     */
    viewModel.commentBlock = function (blockData, parent, index) {
      // Unwrap observables
      const blockId = ko.toJS(blockData).id || null;

      // Open the comments on this block: read and written on.
      viewModel.selectedBlockForComments(blockId);
      store.setTarget(blockId);
      viewModel.lastSelectedBlock(blockId); // Remember for filter chip
      viewModel.showComments(true);
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
    /**
     * The comments held behind the pill join the list; the focus goes to the
     * first of them, as the pill goes.
     */
    viewModel.showNewComments = function () {
      const shown = store.showNew();
      if (!shown.length) return;
      setTimeout(function () {
        const first = document.querySelector(
          '#toolcomments [data-comment-id="' + CSS.escape(shown[0]._id) + '"]'
        );
        if (first) first.focus();
      }, 0);
    };

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
      return viewModel.managesCurrentGroup();
    };

    /**
     * Approving is a capability of its own: the reviewer and the admins
     * (ADR 0020, amending ADR 0004).
     */
    viewModel.canPostDecision = function () {
      return userCan(viewModel, CAPABILITIES.MAILING_APPROVE);
    };

    /**
     * Get decision label for display
     */
    viewModel.getDecisionLabel = function (decision) {
      if (!decision) return '';
      return viewModel.t('comments-decision-' + decision.replace(/_/g, '-'));
    };

    /**
     * Format date for display (relative format)
     * Uses utility with translation function
     */
    viewModel.formatDate = function (dateString) {
      return formatCommentDate(dateString, viewModel.t.bind(viewModel));
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
     * Uses utility function
     */
    viewModel.escapeHtml = escapeHtml;

    /**
     * Format comment text with styled mentions
     * Uses utility function
     */
    viewModel.formatCommentText = formatCommentText;

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
      return findBlockById(viewModel, blockId);
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

      goToBlock(viewModel, comment.blockId);
    };

    // ===== SUBSCRIPTIONS =====

    // The store loads the list at each opening; the users for mentions once.
    const usersSub = viewModel.showComments.subscribe(function (isOpen) {
      if (isOpen) viewModel.loadGroupUsers();
    });

    // The canvas is laid out once the editor is shown: place the markers
    // then. The canvas slides when a panel opens, and the rail follows it on
    // its own; it snaps back when the last one closes, and does not slide with
    // reduced motion: a panel opening or closing places them again too.
    let railTimer = setTimeout(rail.update, 500);
    const placeRailSoon = function () {
      clearTimeout(railTimer);
      railTimer = setTimeout(rail.update, 250);
    };
    const panelSub = viewModel.rightPanel.anyOpen.subscribe(placeRailSoon);
    // The email narrows or widens with the preview (desktop, mobile, both).
    const previewSub = ko.isSubscribable(viewModel.previewMode)
      ? viewModel.previewMode.subscribe(placeRailSoon)
      : null;

    // The block chip of the filter names the block last selected. Selecting
    // a block no longer filters the list: the target of a new comment
    // follows the selection instead (the store, ADR 0020).
    const selectionSub = viewModel.selectedBlock.subscribe(function (block) {
      viewModel.lastSelectedBlock(block ? ko.unwrap(block.id) || null : null);
    });

    // Check URL parameter to auto-open comments panel
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('comments') === '1') {
        // Delay to ensure the editor is fully loaded
        // Opening loads the comments, once.
        setTimeout(function () {
          viewModel.showComments(true);
        }, 500);
      }
    } catch (e) {
      // URLSearchParams not supported or other error
    }

    // The counters of the panel button and the rail, panel closed.
    store.start();

    return {
      dispose: function () {
        clearTimeout(railTimer);
        panelSub.dispose();
        usersSub.dispose();
        selectionSub.dispose();
        store.dispose();
        if (previewSub) previewSub.dispose();
        rail.dispose();
      },
    };
  };
}

module.exports = commentsLoader;
