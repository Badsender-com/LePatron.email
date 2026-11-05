'use strict';

const {
  reconstructMentionsForStorage,
  extractMentionIds,
} = require('../comments-utils.js');

/**
 * What the comments panel writes, on the view model (ADR 0020): the draft
 * on its target or an approval, a reply, an edit. Mentions are shown
 * « @Name » while written and stored « @[Name](id) ». Each resolves to
 * whether it was written; what was written stays when it was not.
 *
 * @param {Object} viewModel
 * @param {Object} options
 * @param {Object} options.store - the comments' store
 * @param {Object} options.actions - ext/comments/comments-actions.js
 */
function installCommentsWriting(viewModel, { store, actions }) {
  const mentionsOf = function (text, tracked) {
    return {
      text: reconstructMentionsForStorage(text, tracked),
      mentions: extractMentionIds(text, tracked),
    };
  };

  /**
   * Posts the draft on its target, or approves the email. Resolves to
   * whether it was posted; the draft stays when it was not.
   */
  viewModel.createComment = function (decision) {
    let text = viewModel.newCommentText().trim();
    if (!text) {
      // Approving needs no written comment: its default text says it.
      if (decision !== 'approved') {
        viewModel.notifier.error(viewModel.t('comments-text-required'));
        return Promise.resolve(false);
      }
      text = viewModel.t('comments-decision-approve-default-text');
    }
    const written = mentionsOf(text, viewModel.trackedMentions());
    return actions
      .create({
        text: written.text,
        mentions: written.mentions,
        // An approval has neither type nor priority (ADR 0020).
        category:
          decision === 'approved' ? 'general' : viewModel.newCommentCategory(),
        severity:
          decision === 'approved' ? 'info' : viewModel.newCommentSeverity(),
        decision: typeof decision === 'string' ? decision : null,
        blockId: store.target(),
      })
      .then(
        function () {
          store.clearDraft();
          // The next comment follows the selection again.
          store.followSelection();
          viewModel.trackedMentions.removeAll();
          return true;
        },
        function () {
          return false;
        }
      );
  };

  // A reply is on its comment's block, and only says something.
  viewModel.replyToComment = function (parent, text, tracked) {
    const written = mentionsOf(text.trim(), tracked || []);
    if (!written.text) {
      viewModel.notifier.error(viewModel.t('comments-text-required'));
      return Promise.resolve(false);
    }
    return actions
      .create({
        text: written.text,
        mentions: written.mentions,
        category: 'general',
        severity: 'info',
        blockId: parent.blockId || null,
        parentCommentId: parent._id,
      })
      .then(
        () => true,
        () => false
      );
  };

  viewModel.editComment = function (comment, text, tracked) {
    const written = mentionsOf(text.trim(), tracked || []);
    if (!written.text) {
      viewModel.notifier.error(viewModel.t('comments-text-required'));
      return Promise.resolve(false);
    }
    return actions.update(comment, written.text).then(
      () => true,
      () => false
    );
  };
}

module.exports = { installCommentsWriting };
