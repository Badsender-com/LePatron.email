'use strict';

const $ = require('jquery');
const ko = require('knockout');
const { userCan } = require('./user-can.js');
const { CAPABILITIES } = require('../../../../shared/access/roles.js');
const {
  formatBlockName,
  formatCommentDate,
} = require('./comments-utils.js');
const { findBlockById, goToBlock } = require('./block-navigation.js');
const { installRightPanel } = require('./right-panel.js');
const { createCommentsRail } = require('./comments/comments-rail.js');
const { createCommentsStore } = require('./comments/comments-store.js');
const { createCommentsApi } = require('./comments/comments-api.js');
const { createCommentsActions } = require('./comments/comments-actions.js');
const { installCommentsWriting } = require('./comments/comments-writing.js');
const { installCommentsOpening } = require('./comments/comments-opening.js');

/**
 * The comments of the editor (ADR 0020): their store, the markers rail beside
 * the email, and what the canvas, the quality control and the comments panel
 * (js/vue/commentsPanelPlugin.js, in Vue) read and call on the view model.
 */
function commentsLoader(opts) {
  const mailingId = opts.metadata.id;
  const groupId = opts.metadata.groupId;
  const apiBaseUrl = '/api';

  return function (viewModel) {
    // One of the right panels: opening it closes quality control or the AI
    // panel (ADR 0010).
    viewModel.showComments = installRightPanel(viewModel, ko).flag('comments');
    const store = createCommentsStore(ko, {
      api: createCommentsApi({ apiBaseUrl, mailingId }),
      isOpen: viewModel.showComments,
      selection: viewModel.selectedBlock,
    });
    const actions = createCommentsActions({
      ajax: $.ajax,
      store,
      apiBaseUrl,
      mailingId,
      notifier: () => viewModel.notifier,
      t: (key, params) => viewModel.t(key, params),
    });
    viewModel.commentsStore = store;
    viewModel.commentsActions = actions;

    // The names the canvas and the quality control read.
    viewModel.comments = store.comments;
    viewModel.commentsStatus = store.status;
    viewModel.commentCounts = store.counts;
    viewModel.selectedBlockForComments = store.filter;
    viewModel.commentTarget = store.target;
    viewModel.newCommentText = store.draftText;
    viewModel.newCommentCategory = store.draftCategory;
    viewModel.newCommentSeverity = store.draftSeverity;
    viewModel.unresolvedCommentCount = store.unresolvedCount;
    // Whether a comment is being written, which the quality control does not
    // interrupt (ext/quality/quality-review.js).
    viewModel.hasCommentDraft = function () {
      return store.hasDraft();
    };

    // The company's users, for mentions; and the mentions chosen in the draft.
    viewModel.groupUsers = ko.observableArray([]);
    viewModel.trackedMentions = ko.observableArray([]);

    // A blocking comment open keeps the email from being approved: the server
    // refuses it too (ADR 0020). Root comments only, never an approval; held
    // behind the pill included, as the server counts them.
    viewModel.hasOpenBlocking = ko.pureComputed(function () {
      return store.allComments().some(function (c) {
        return (
          !c.resolved &&
          !c._parentComment &&
          c.severity === 'blocking' &&
          c.decision !== 'approved'
        );
      });
    });

    // ===== BLOCKS =====
    // The type of a block, as the rail and the block tool name it.
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

    // « Cover · bloc 2 »: its type, and its place among the blocks of the
    // email; a block out of the list (a header) by its type alone.
    viewModel.commentBlockLabel = function (blockId) {
      try {
        const blocks = viewModel.content().mainBlocks().blocks();
        const place = blocks.findIndex(function (block) {
          return ko.unwrap(ko.unwrap(block).id) === blockId;
        });
        if (place === -1) return labelOfBlock(blockId);
        return (
          labelOfBlock(blockId) +
          ' · ' +
          viewModel.t('comments-block-place', { place: place + 1 })
        );
      } catch (e) {
        return labelOfBlock(blockId);
      }
    };

    // Changes whenever the blocks of the email change: the panel, in Vue,
    // reads their labels again.
    viewModel.commentBlocksVersion = ko.pureComputed(function () {
      try {
        return viewModel
          .content()
          .mainBlocks()
          .blocks()
          .map(function (block) {
            return ko.unwrap(ko.unwrap(block).id);
          })
          .join(',');
      } catch (e) {
        return '';
      }
    });

    // Any block of the email, its header and footer included.
    viewModel.blockExists = function (blockId) {
      return !blockId || Boolean(findBlockById(viewModel, blockId));
    };

    viewModel.goToCommentBlock = function (comment) {
      if (!viewModel.blockExists(comment.blockId)) {
        viewModel.notifier.warning(viewModel.t('comments-block-deleted'));
        return;
      }
      goToBlock(viewModel, comment.blockId);
    };

    // ===== THE COMMENT MARKERS RAIL =====
    // Beside the email (ADR 0020): it stays in Knockout, in the canvas.
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

    viewModel.getBlockCommentCount = function (blockId) {
      const blockData = viewModel.commentCounts()[blockId];
      if (!blockData) return 0;
      // Older answers give a number, newer { count, maxSeverity }.
      return typeof blockData === 'object' ? blockData.count : blockData;
    };

    // ===== LOADING =====
    // The list, as at an opening; the counters follow it once loaded.
    viewModel.loadComments = function () {
      return store.load().catch(function () {
        viewModel.notifier.error(viewModel.t('comments-load-error'));
      });
    };

    // The counters before the list loads; afterwards they come from it.
    viewModel.loadCommentCounts = function () {
      if (!store.listLoaded()) store.start();
    };

    viewModel.loadGroupUsers = function () {
      if (viewModel.groupUsers().length > 0) return;
      $.ajax({
        url: apiBaseUrl + '/groups/' + encodeURIComponent(groupId) + '/users',
        method: 'GET',
        success: function (response) {
          viewModel.groupUsers((response && response.items) || response || []);
        },
      });
    };

    installCommentsWriting(viewModel, { store, actions });
    installCommentsOpening(viewModel, { store });

    // ===== RIGHTS =====
    viewModel.isCommentAuthor = function (comment) {
      const currentUser = viewModel.currentUser();
      if (!currentUser || !comment._author) return false;
      // .id, not ._id: mongoose-hidden hides _id from the user's JSON.
      const authorId =
        typeof comment._author === 'object'
          ? comment._author.id || comment._author._id
          : comment._author;
      return (currentUser.id || currentUser._id) === authorId;
    };

    // Its author, or whoever moderates the comments of the company.
    viewModel.canDeleteComment = function (comment) {
      if (!viewModel.currentUser()) return false;
      return (
        viewModel.isCommentAuthor(comment) || viewModel.managesCurrentGroup()
      );
    };

    // Approving is a capability of its own: the reviewer and the admins
    // (ADR 0020, amending ADR 0004).
    viewModel.canPostDecision = function () {
      return userCan(viewModel, CAPABILITIES.MAILING_APPROVE);
    };

    viewModel.formatDate = function (dateString) {
      return formatCommentDate(dateString, viewModel.t.bind(viewModel));
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

    // ?comments=1, from the list of emails: the panel opens, which loads the
    // comments, once.
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('comments') === '1') {
        setTimeout(function () {
          viewModel.showComments(true);
        }, 500);
      }
    } catch (e) {
      // No URLSearchParams: the panel stays closed.
    }

    // The counters of the panel button and the rail, panel closed.
    store.start();

    return {
      dispose: function () {
        clearTimeout(railTimer);
        panelSub.dispose();
        usersSub.dispose();
        store.dispose();
        if (previewSub) previewSub.dispose();
        rail.dispose();
      },
    };
  };
}

module.exports = commentsLoader;
