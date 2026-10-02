'use strict';

const {
  DRAGGING_CLASS,
  DROP_BEFORE_CLASS,
  DROP_AFTER_CLASS,
  PREVIEW_READY_EVENT,
} = require('./preview-surface.js');

// Dragging an element from the palette into the preview.
//
// A mixin for the same reason the preview is one: every method here reads or
// writes the component's state — what is being dragged, where it would land.
// That state is declared here, with the gesture it belongs to.
//
// It depends on the preview surface and not the other way round: the preview
// owns the iframe, its stylesheet and the class names; this adds a gesture on
// top of it, through what the preview makes public — PREVIEW_READY_EVENT to
// listen on its document, `freezeRender` / `thawRender` to hold it still,
// `previewDocument` and `previewRows` to measure it. `insertElement` comes from
// the element list.

const DragSurfaceMixin = {
  data: () => ({
    // The palette entry currently being dragged.
    draggingType: null,
  }),
  created() {
    this.$on(PREVIEW_READY_EVENT, this.listenOnPreview);
  },
  methods: {
    // `dragover` has to cancel the event on every move, or the browser refuses
    // the drop outright — the one rule of the HTML5 drag API that everybody
    // forgets.
    listenOnPreview(doc) {
      doc.addEventListener('dragenter', this.handlePreviewDragOver);
      doc.addEventListener('dragover', this.handlePreviewDragOver);
      doc.addEventListener('drop', this.handlePreviewDrop);
      doc.addEventListener('dragleave', this.handlePreviewDragLeave);
    },

    // ---- dragging from the palette into the preview -----------------------

    // The drag carries its type in `dataTransfer` as well as in component
    // state. The state is what the drop reads — both ends are ours — but
    // `setData` is not optional: without it Firefox never starts the drag.
    //
    // THE EVENT MUST NOT REACH `window`. Mosaico installs listeners there that
    // cancel `dragstart` and `drag` outright (template-loader.js
    // `fixPageEvents`, called from app.js), so that the browser's native drag
    // cannot fight the jQuery UI sortable driving the canvas. That protection
    // is right for the rest of the page and wrong for this palette, which is
    // the one place a native drag is wanted — so the event is stopped here
    // rather than the protection weakened there.
    handleDragStart(type, event) {
      event.stopPropagation();
      this.draggingType = type;
      this.freezeRender();
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', type);
      }
      const doc = this.previewDocument();
      if (doc && doc.body) doc.body.classList.add(DRAGGING_CLASS);
    },

    // `drag` fires continuously at the source for the whole gesture, and
    // cancelling it cancels the drop — so Mosaico's window listener has to be
    // kept away from this one too, not just from `dragstart`.
    handleDrag(event) {
      event.stopPropagation();
    },

    handleDragEnd() {
      this.draggingType = null;
      this.clearDropIndicator();
      const doc = this.previewDocument();
      if (doc && doc.body) doc.body.classList.remove(DRAGGING_CLASS);
      // Renders were held while the rows had to stay still under the cursor.
      this.thawRender();
    },

    handlePreviewDragOver(event) {
      if (!this.draggingType) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';

      const doc = this.previewDocument();
      if (!doc || !doc.body) return;
      doc.body.classList.add(DRAGGING_CLASS);

      this.showDropIndicator(doc, this.dropIndexAt(doc, event.clientY));
    },

    // Leaving the iframe entirely, rather than crossing between two rows:
    // `relatedTarget` is null (or outside the document) only for the former.
    //
    // Firefox leaves `relatedTarget` null on `dragleave` more often than that,
    // so crossing a row boundary there clears the indicator — and the very next
    // `dragover` puts it back. A frame of flicker at worst; doing better means
    // counting enters and leaves, which is its own source of stuck state.
    handlePreviewDragLeave(event) {
      const leaving = event.relatedTarget;
      const doc = this.previewDocument();
      if (!doc) return;
      if (leaving && doc.contains(leaving)) return;
      this.clearDropIndicator();
    },

    // The index is measured again rather than kept from the last dragover: the
    // drop carries its own coordinates, and they are the ones that count.
    handlePreviewDrop(event) {
      if (!this.draggingType) return;
      event.preventDefault();

      const doc = this.previewDocument();
      const index = doc ? this.dropIndexAt(doc, event.clientY) : 0;
      const type = this.draggingType;

      this.handleDragEnd();
      this.insertElement(type, index);
    },

    /**
     * Where an element dropped at this height would go.
     *
     * Measured against each row's midpoint: above it the element goes before,
     * below it after. Past the last row, at the end.
     *
     * @returns {number} an index in `state.elements`
     */
    dropIndexAt(doc, clientY) {
      const rows = this.previewRows(doc);
      for (let i = 0; i < rows.length; i++) {
        const box = rows[i].getBoundingClientRect();
        if (clientY < box.top + box.height / 2) return i;
      }
      return rows.length;
    },

    showDropIndicator(doc, index) {
      const rows = this.previewRows(doc);
      this.clearDropIndicator();
      if (!rows.length) return;

      if (index < rows.length) {
        rows[index].classList.add(DROP_BEFORE_CLASS);
      } else {
        rows[rows.length - 1].classList.add(DROP_AFTER_CLASS);
      }
    },

    clearDropIndicator() {
      this.previewRows(this.previewDocument()).forEach((row) => {
        row.classList.remove(DROP_BEFORE_CLASS);
        row.classList.remove(DROP_AFTER_CLASS);
      });
    },
  },
};

module.exports = { DragSurfaceMixin };
