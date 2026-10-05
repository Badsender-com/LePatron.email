'use strict';

const {
  serialiseState,
} = require('../../../../../../shared/block-builder/state.js');

// What happens when the modal is dismissed rather than closed: Escape, or a
// click on the backdrop.
//
// A composition lives only in the modal until it is applied, so a stray Escape
// used to throw it away without a word. A modified composition now asks first.
// And an Escape meant for a dialog opened FROM the modal — the image gallery,
// a TinyMCE link dialog — is not a dismissal of the modal at all: the modal
// listens on the whole document, so it hears that Escape too.
//
// A Vue 2 mixin, like the element list and the preview surface. The component
// is expected to provide: `state` and `vm`.

// Where a dialog opened from the modal lives. Both sit outside the modal's own
// DOM: the gallery is the editor's (dialog-select-image.tmpl.html), and TinyMCE
// renders its windows, menus and toolbars at the end of the page.
const CHILD_DIALOG_SELECTOR = '#dialogGallery, .mce-container';

/**
 * Whether a dialog opened from the modal is open, or is where the event came
 * from.
 *
 * The event's target is checked as well as the document: TinyMCE closes its
 * window on that same Escape before the document hears it, so by then the
 * window is gone — but the target is still inside it.
 *
 * @param {Object} vm the editor view-model
 * @param {Event} [event]
 * @returns {boolean}
 */
function childDialogOpen(vm, event) {
  if (typeof vm.showDialogGallery === 'function' && vm.showDialogGallery()) {
    return true;
  }
  const target = event && event.target;
  if (target && typeof target.closest === 'function') {
    if (target.closest(CHILD_DIALOG_SELECTOR)) return true;
  }
  return document.querySelector('.mce-window') !== null;
}

const DismissalMixin = {
  data: () => ({
    // The composition as it was opened, to tell whether dismissing loses work.
    openedState: '',
  }),
  methods: {
    rememberOpenedState() {
      this.openedState = serialiseState(this.state);
    },

    isModified() {
      return serialiseState(this.state) !== this.openedState;
    },

    // Handed to the modal as `before-dismiss`.
    confirmDismiss(event) {
      if (childDialogOpen(this.vm, event)) return false;
      if (!this.isModified()) return true;
      // The browser's own dialog, as the comments do for a deletion
      // (badsender-comments.js): it is modal over the modal, keyboard
      // accessible, and needs no z-index of its own.
      return window.confirm(this.vm.t('block-builder-discard-confirm'));
    },
  },
};

module.exports = { DismissalMixin, childDialogOpen };
