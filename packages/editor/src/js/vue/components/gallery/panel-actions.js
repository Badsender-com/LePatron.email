'use strict';

/**
 * What the panel does when a thumbnail asks: insert, edit, rename, delete.
 * Each one goes through the Mosaico viewModel, whose extensions own the
 * requests and the Knockout lists. Mixed into the panel; reads its `type`
 * and its `viewModel`.
 */
module.exports = {
  methods: {
    // a click replaces the image of the selected placeholder
    onSelect(file) {
      this.viewModel.addImage(file);
    },
    // Reopen the image editor on an image already in the gallery. The
    // panel's own root is what the extension uses to find the upload
    // widget of this pane rather than the other one's.
    onEdit(file) {
      this.viewModel.editGalleryImage(file, this.type, this.$el);
    },
    // asks for confirmation first (badsender-remove-gallery-image.js)
    onRemove(file) {
      this.viewModel.removeImage(file, this.type);
    },
    // The rename writes into the Knockout observable, not into this mirror:
    // that array is what the rest of the editor reads, so the optimistic
    // update has to land there and flow back through the subscription.
    onRename(file, label) {
      const { notifier } = this.viewModel;
      this.viewModel.renameImage(file, this.type, label).then((saved) => {
        if (saved) notifier.success(this.t('gallery-rename-image-success'));
      });
    },
    // the thumbnail refused the input before it ever reached the server
    onRenameRejected(messageKey) {
      this.viewModel.notifier.error(this.t(messageKey));
    },
  },
};
