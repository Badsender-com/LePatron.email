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
      const index = this.visibleImages.findIndex((f) => f.name === file.name);
      const trigger = document.activeElement;
      return Promise.resolve(this.viewModel.removeImage(file, this.type)).then(
        (removed) => {
          if (removed) this.focusAfterRemoval(index, trigger);
        }
      );
    },
    // The trash button goes with its thumbnail: out of the DOM, or parked
    // hidden by the scroller, or recycled onto another image. The focus would
    // fall to the page's body, sending a keyboard user back to the top of
    // the editor. It goes to the image now in that place, or the one before,
    // or the search field when none is left to show. Only when it was still
    // on the trash: a focus the user put elsewhere meanwhile is theirs.
    focusAfterRemoval(index, trigger) {
      // the panel's own update, then the scroller's views
      this.$nextTick(() =>
        this.$nextTick(() => {
          const active = document.activeElement;
          const lost = !active || active === document.body;
          if (!lost && active !== trigger) return;
          const target =
            this.pickAt(Math.min(index, this.visibleImages.length - 1)) ||
            this.$refs.searchInput;
          if (target) target.focus();
        })
      );
    },
    pickAt(index) {
      if (index < 0) return null;
      return this.$el.querySelector(
        `.gallery-vue-cell[data-gallery-index="${index}"]:not([hidden]) [data-gallery-pick]`
      );
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
