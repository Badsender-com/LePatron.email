'use strict';

const {
  DRAGGING_CLASS,
  MOVING_CLASS,
  PREVIEW_READY_EVENT,
  PREVIEW_RENDERED_EVENT,
} = require('./preview-surface.js');
const {
  ELEMENT_ATTRIBUTE,
} = require('../../../../../../shared/block-builder/generate.js');
const { dropIndexAt, showDropLine, clearDropLine } = require('./drop-line.js');

// Dragging in the preview: an element from the palette, to insert it, or a row
// already in the block, to move it. Same indicator, same drop maths — only what
// happens on drop differs.
//
// A mixin for the same reason the preview is one: every method here reads or
// writes the component's state — what is being dragged, which entry or row
// shows it.
// That state is declared here, with the gesture it belongs to.
//
// It depends on the preview surface and not the other way round: the preview
// owns the iframe, its stylesheet and the names in it; this adds a gesture on
// top of it, through what the preview makes public — PREVIEW_READY_EVENT to
// listen on its document, PREVIEW_RENDERED_EVENT to make its rows draggable,
// `freezeRender` / `thawRender` to hold it still, `elementRowFromEvent` to
// find the row picked up, `previewDocument` and `previewRows` to measure it,
// which drop-line.js turns into a drop position.
// `insertElement` and `moveElementTo` come from the element list.

// What either drag puts on the dataTransfer. A type of our own, never
// `text/plain`: a drag released over the settings panel's TinyMCE field would
// otherwise be pasted there by its paste plugin, as the word "text" or "image"
// — or, for a reorder, an element id. Firefox starts a drag on any type, which
// is all `setData` is needed for here.
const DRAG_TYPE = 'application/x-lp-block-builder';

const DragSurfaceMixin = {
  data: () => ({
    // What is being dragged: a palette entry to insert, or the id of an
    // element already in the block to move. Never both.
    draggingType: null,
    draggingId: null,
    // The palette entry, a moment later: it is faded only once the browser
    // has taken its picture for the drag image (see handleDragStart).
    fadedType: null,
  }),
  created() {
    // Not reactive: nothing renders off them.
    this.fadeTimer = null;
    this.selectionBeforeDrag = null;
    this.$on(PREVIEW_READY_EVENT, this.listenOnPreview);
    this.$on(PREVIEW_RENDERED_EVENT, this.makeRowsDraggable);
  },
  // A modal destroyed mid-drag gets no dragend: what the drag put on the page
  // is taken off here, without the render a normal end would ask for.
  beforeDestroy() {
    this.releasePage();
  },
  methods: {
    // `dragover` has to cancel the event on every move, or the browser refuses
    // the drop outright — the one rule of the HTML5 drag API that everybody
    // forgets.
    //
    // Mosaico's page guard (see handleDragStart) lives on the editor's
    // `window`, and events inside the iframe never reach it: the preview
    // document needs a guard of its own, which is what refusing every
    // `dragstart` but a row's, and the unconditional cancels below, are.
    //
    // `dragend` fires at the source of the drag, and the source of a reorder
    // is a row in here: the palette's own dragend is bound on its entries.
    listenOnPreview(doc) {
      doc.addEventListener('dragstart', this.handlePreviewDragStart);
      doc.addEventListener('dragend', this.handleDragEnd);
      doc.addEventListener('dragenter', this.handlePreviewDragOver);
      doc.addEventListener('dragover', this.handlePreviewDragOver);
      doc.addEventListener('drop', this.handlePreviewDrop);
      doc.addEventListener('dragleave', this.handlePreviewDragLeave);
    },

    /** True while either kind of drag is under way. */
    isDragging() {
      return Boolean(this.draggingType || this.draggingId);
    },

    // Never both. WebKit can lose the dragend of a drag that crossed the
    // iframe's edge, and a drag whose end never came is still "under way"
    // when the next one starts: its id would be read by the next drop, which
    // would move the old row instead of inserting. So each drag starts by
    // ending whatever the last one left behind.
    endLostDrag() {
      if (this.isDragging()) this.handleDragEnd();
    },

    // ---- dragging from the palette into the preview -----------------------

    // The drag carries its type in `dataTransfer` as well as in component
    // state. The state is what the drop reads — both ends are ours — but
    // `setData` is not optional: without it Firefox never starts the drag.
    // Cleared first, so nothing the browser filled in by itself rides along.
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
      this.endLostDrag();
      this.draggingType = type;
      this.freezeRender();
      if (event.dataTransfer) {
        event.dataTransfer.clearData();
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData(DRAG_TYPE, type);
      }
      const doc = this.previewDocument();
      if (doc && doc.body) doc.body.classList.add(DRAGGING_CLASS);
      // The browser snapshots the entry for the drag image after this handler
      // returns: faded now, the ghost would come out faded twice.
      this.fadeTimer = window.setTimeout(() => {
        this.fadedType = type;
      }, 0);
      this.holdPage();
    },

    // Mosaico cancels `dragover` on the whole editor window (fixPageEvents),
    // which tells the browser the entire page accepts the drop: the cursor
    // said "copy" over the palette, the settings, the backdrop. Only the
    // preview accepts this drag, and its events never reach this document, so
    // everything that does reach it is refused — explicitly, so the cursor
    // says so. A reorder leaving the iframe meets the same page, so it is
    // refused the same way.
    holdPage() {
      document.addEventListener('dragenter', this.refuseOutsidePreview);
      document.addEventListener('dragover', this.refuseOutsidePreview);
    },

    refuseOutsidePreview(event) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    },

    // `drag` fires continuously at the source for the whole gesture, and
    // cancelling it cancels the drop — so Mosaico's window listener has to be
    // kept away from this one too, not just from `dragstart`.
    handleDrag(event) {
      event.stopPropagation();
    },

    releasePage() {
      document.removeEventListener('dragenter', this.refuseOutsidePreview);
      document.removeEventListener('dragover', this.refuseOutsidePreview);
      window.clearTimeout(this.fadeTimer);
    },

    // A reorder still under way here was never dropped — Escape, or let go
    // outside the preview. It moved nothing, so it changes no selection
    // either: the one its dragstart replaced comes back.
    handleDragEnd() {
      if (this.draggingId) this.selectedId = this.selectionBeforeDrag;
      this.releasePage();
      this.fadedType = null;
      this.draggingType = null;
      this.draggingId = null;
      const doc = this.previewDocument();
      clearDropLine(doc);
      if (doc && doc.body) {
        doc.body.classList.remove(DRAGGING_CLASS);
        this.previewRows(doc).forEach((row) =>
          row.classList.remove(MOVING_CLASS)
        );
      }
      // Renders were held while the rows had to stay still under the cursor.
      this.thawRender();
    },

    // ---- moving a row of the preview ---------------------------------------

    // Preview chrome, set on the rendered nodes rather than written into the
    // markup: `draggable` has no business in an email, and the generated HTML
    // is what ships. The images and links inside a row are natively draggable
    // and would be what the browser picks up — the picture under the cursor
    // would be an image or a URL rather than the row being moved — so they are
    // switched off, leaving the row as the one thing to drag.
    makeRowsDraggable(doc) {
      this.previewRows(doc).forEach((row) => {
        row.draggable = true;
        Array.prototype.forEach.call(
          row.querySelectorAll('img, a'),
          (node) => {
            node.draggable = false;
          }
        );
      });
    },

    // The one drag the preview starts. Anything else starting there — an image
    // or a link a browser lets through anyway, a text selection — would carry
    // a URL or text, and dropped back in, have the browser open it in the
    // iframe, navigating away from the composition: cancelled.
    //
    // Unlike the palette's, this `dragstart` starts inside the iframe, so it
    // never reaches the editor's `window` nor meets Mosaico's guard — which is
    // why it needs no stopPropagation. Worth knowing before someone removes
    // the palette's and finds it still works here.
    handlePreviewDragStart(event) {
      const row = this.elementRowFromEvent(event);
      if (!row) {
        event.preventDefault();
        return;
      }

      this.endLostDrag();
      const id = row.getAttribute(ELEMENT_ATTRIBUTE);
      this.draggingId = id;
      this.freezeRender();
      if (event.dataTransfer) {
        event.dataTransfer.clearData();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(DRAG_TYPE, id);
      }
      // Selecting what is being moved, so the settings panel follows the thing
      // under the cursor rather than staying on whatever was selected before
      // — which is kept, for a drag that ends without a drop.
      this.selectionBeforeDrag = this.selectedId;
      this.selectedId = id;
      row.ownerDocument.body.classList.add(DRAGGING_CLASS);
      // Dimmed once the browser has taken its picture, as the palette entry is.
      this.fadeTimer = window.setTimeout(() => {
        row.classList.add(MOVING_CLASS);
      }, 0);
      this.holdPage();
    },

    // ---- over the preview, and the drop -------------------------------------

    // Cancelled whatever is being dragged, so the browser never applies its
    // own default; whether it is OUR drag decides only between accepting the
    // drop and refusing it.
    handlePreviewDragOver(event) {
      event.preventDefault();
      if (!this.isDragging()) {
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
        return;
      }
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = this.draggingId ? 'move' : 'copy';
      }

      const doc = this.previewDocument();
      if (!doc || !doc.body) return;
      doc.body.classList.add(DRAGGING_CLASS);

      const rows = this.previewRows(doc);
      const index = dropIndexAt(rows, event.clientY);
      showDropLine(doc, rows, index, this.draggingId);
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
      clearDropLine(this.previewDocument());
    },

    // The index is measured again rather than kept from the last dragover: the
    // drop carries its own coordinates, and they are the ones that count.
    handlePreviewDrop(event) {
      event.preventDefault();
      if (!this.isDragging()) return;

      const doc = this.previewDocument();
      const index = doc ? dropIndexAt(this.previewRows(doc), event.clientY) : 0;
      const type = this.draggingType;
      const id = this.draggingId;

      // Ended as a drop, not a cancel: the selection goes to what moved.
      this.draggingId = null;
      this.handleDragEnd();
      if (id) this.moveElementTo(id, index);
      else this.insertElement(type, index);
    },
  },
};

module.exports = { DragSurfaceMixin, DRAG_TYPE };
