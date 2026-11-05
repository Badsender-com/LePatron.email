'use strict';

const ko = require('knockout');
const { findBlockById, goToBlock } = require('../block-navigation.js');

/**
 * The ways into the comments panel (ADR 0020): a marker of the rail, the
 * block toolbar, « Ajouter un commentaire » of the quality control, and the
 * new comments shown from the pill.
 *
 * @param {Object} viewModel
 * @param {Object} options
 * @param {Object} options.store - the comments' store
 */
function installCommentsOpening(viewModel, { store }) {
  const focusForm = function () {
    setTimeout(function () {
      const text = document.querySelector(
        '#toolcomments .comment-composer textarea'
      );
      if (text) text.focus();
    }, 150);
  };

  // From the markers rail: the block's comments, read and written on.
  viewModel.openCommentsForBlock = function (blockId) {
    store.filter(blockId);
    store.setTarget(blockId);
    viewModel.showComments(true);
    goToBlock(viewModel, blockId);
    focusForm();
  };

  // From the block toolbar: the same, the block already selected.
  viewModel.commentBlock = function (blockData) {
    const blockId = ko.toJS(blockData).id || null;
    store.filter(blockId);
    store.setTarget(blockId);
    viewModel.showComments(true);
    focusForm();
  };

  /**
   * "Add a comment" of a quality finding: the panel opens with the form
   * filled in, on the finding's block, or the whole email when it has none
   * or it was deleted since. Nothing is posted: the user sends it.
   * @param {{ blockId: ?string, text: string, severity: string, category: string }} draft
   */
  viewModel.createCommentFromQc = function (draft) {
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

  // The comments held behind the pill join the list; the focus goes to the
  // first of them, as the pill goes.
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
}

module.exports = { installCommentsOpening };
