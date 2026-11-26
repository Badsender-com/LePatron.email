'use strict';

// The editor page around the modal, while one of our drags is under way.
//
// Mosaico cancels `dragover` on the whole editor window (template-loader.js
// `fixPageEvents`), which tells the browser the entire page accepts the drop:
// the cursor said "copy" over the palette, the settings, the backdrop. Only
// the preview accepts an element, and its events never reach this document,
// so everything that does reach it is refused — explicitly, so the cursor
// says so. An element moved out of the iframe meets the same page, so it is
// refused the same way; a row is accepted by its list, which keeps its events
// from reaching here (row-drag.js).
//
// A Vue 2 mixin, shared by every drag (drag-surface.js, row-drag.js): the
// listeners are the component's methods, so they can be taken off again.

const PageGuardMixin = {
  // A modal destroyed mid-drag gets no dragend: what the drag put on the page
  // is taken off here, without the render a normal end would ask for.
  beforeDestroy() {
    this.releasePage();
  },
  methods: {
    holdPage() {
      document.addEventListener('dragenter', this.refuseOutsidePreview);
      document.addEventListener('dragover', this.refuseOutsidePreview);
    },

    refuseOutsidePreview(event) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    },

    releasePage() {
      document.removeEventListener('dragenter', this.refuseOutsidePreview);
      document.removeEventListener('dragover', this.refuseOutsidePreview);
    },
  },
};

module.exports = { PageGuardMixin };
