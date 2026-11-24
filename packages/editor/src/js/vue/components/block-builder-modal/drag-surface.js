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
const { showDropLine, clearDropLine } = require('./drop-line.js');

// Dragging in the preview, two gestures in one: an element from the palette,
// to insert it, or an element already in the block, to move it. Same
// indicator and same drop maths; what the drop does is the difference.
//
// A mixin for the same reason the preview is one: every method here reads or
// writes the component's state — what is being dragged, which entry or
// element shows it. That state is declared here, with the gesture it belongs
// to.
//
// It depends on the preview surface and not the other way round: the preview
// owns the iframe, its stylesheet and the names in it; this adds a gesture on
// top of it, through what the preview makes public — PREVIEW_READY_EVENT to
// listen on its document, PREVIEW_RENDERED_EVENT to make its elements
// draggable, `freezeRender` / `thawRender` to hold it still,
// `previewElementFromEvent` to find the element picked up,
// `previewDocument` and `previewElements` to reach them. Where a drag lands
// is column-target.js (`aimAt`, `dropTarget`, `canDropInto`), and the line
// that shows it drop-line.js. `insertElement` and `moveElement` come from the
// element list.

// What every drag of ours puts on the dataTransfer, a row's too (row-drag.js).
// A type of our own, never `text/plain`: a drag released over the settings
// panel's TinyMCE field would otherwise be pasted there by its paste plugin,
// as the word "text" or "image" — or, for a move, an id. Firefox starts a drag
// on any type, which is all `setData` is needed for here.
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
    // Or a row of the list, by row-drag.js: the end below is shared.
    draggingRowId: null,
  }),
  created() {
    // Not reactive: nothing renders off them.
    this.fadeTimer = null;
    this.selectionBeforeDrag = null;
    this.$on(PREVIEW_READY_EVENT, this.listenOnPreview);
    this.$on(PREVIEW_RENDERED_EVENT, this.makeElementsDraggable);
  },
  beforeDestroy() {
    window.clearTimeout(this.fadeTimer);
  },
  methods: {
    // Mosaico's page guard (see handleDragStart) lives on the editor's
    // `window`, and events inside the iframe never reach it: the preview
    // document needs a guard of its own, which is what refusing every
    // `dragstart` but an element's, and the unconditional cancels of dragover
    // and drop, are.
    //
    // `dragend` fires at the source of the drag, and the source of a move is
    // an element in here: the palette's own dragend is bound on its entries.
    listenOnPreview(doc) {
      doc.addEventListener('dragstart', this.handlePreviewDragStart);
      doc.addEventListener('dragend', this.handleDragEnd);
      doc.addEventListener('dragenter', this.handlePreviewDragOver);
      doc.addEventListener('dragover', this.handlePreviewDragOver);
      doc.addEventListener('drop', this.handlePreviewDrop);
      doc.addEventListener('dragleave', this.handlePreviewDragLeave);
    },

    /** True while any of the three drags is under way. */
    isDragging() {
      return Boolean(this.draggingType || this.draggingId || this.draggingRowId);
    },

    // Never both. WebKit can lose the dragend of a drag that crossed the
    // iframe's edge, and a drag whose end never came is still "under way"
    // when the next one starts: its id would be read by the next drop, which
    // would move the old element instead of inserting. So each drag starts by
    // ending whatever the last one left behind.
    endLostDrag() {
      if (this.isDragging()) this.handleDragEnd();
    },

    // ---- starting from the palette -----------------------------------------

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

    // `drag` fires continuously at the source for the whole gesture, and
    // cancelling it cancels the drop — so Mosaico's window listener has to be
    // kept away from this one too, not just from `dragstart`.
    handleDrag(event) {
      event.stopPropagation();
    },

    // The one end of every drag — the palette's, an element's, a row's —
    // dropped or not. A move still under way here was never dropped —
    // Escape, or let go outside where it lands. It moved nothing, so it
    // changes no selection either: the one its dragstart replaced comes back,
    // element or row.
    handleDragEnd() {
      if (this.draggingId || this.draggingRowId) {
        this.restoreSelection(this.selectionBeforeDrag);
      }
      this.releasePage();
      window.clearTimeout(this.fadeTimer);
      this.fadedType = null;
      this.draggingType = null;
      this.draggingId = null;
      this.draggingRowId = null;
      this.rowDropIndex = null;
      this.setDropTarget(null);
      const doc = this.previewDocument();
      clearDropLine(doc);
      if (doc && doc.body) {
        doc.body.classList.remove(DRAGGING_CLASS);
        this.previewElements(doc).forEach((node) =>
          node.classList.remove(MOVING_CLASS)
        );
      }
      // Renders were held while the elements had to stay still under the cursor.
      this.thawRender();
    },

    // ---- moving an element of the preview ----------------------------------

    // Preview chrome, set on the rendered nodes rather than written into the
    // markup: `draggable` has no business in an email, and the generated HTML
    // is what ships. The images and links inside an element are natively
    // draggable and would be what the browser picks up — the picture under
    // the cursor would be an image or a URL rather than the element being
    // moved — so they are switched off, leaving the element as the one thing
    // to drag.
    makeElementsDraggable(doc) {
      this.previewElements(doc).forEach((element) => {
        element.draggable = true;
        Array.prototype.forEach.call(
          element.querySelectorAll('img, a'),
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
      const node = this.previewElementFromEvent(event);
      if (!node) {
        event.preventDefault();
        return;
      }

      this.endLostDrag();
      const id = node.getAttribute(ELEMENT_ATTRIBUTE);
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
      this.selectionBeforeDrag = this.selection;
      this.selectElement(id);
      node.ownerDocument.body.classList.add(DRAGGING_CLASS);
      // Dimmed once the browser has taken its picture, as the palette entry is.
      this.fadeTimer = window.setTimeout(() => {
        node.classList.add(MOVING_CLASS);
      }, 0);
      this.holdPage();
    },

    // ---- over the preview, and the drop -------------------------------------

    // `dragover` has to cancel the event on every move, or the browser refuses
    // the drop outright — the one rule of the HTML5 drag API that everybody
    // forgets. Cancelled whatever is being dragged, so the browser never
    // applies its own default; whether it is a drag of the preview's decides
    // only between accepting the drop and refusing it. A row of the list is
    // not: it is dropped in the list (row-drag.js).
    handlePreviewDragOver(event) {
      event.preventDefault();
      if (!this.isPreviewDrag()) {
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
        return;
      }
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = this.draggingId ? 'move' : 'copy';
      }

      const doc = this.previewDocument();
      if (!doc || !doc.body) return;
      doc.body.classList.add(DRAGGING_CLASS);

      const target = this.aimAt(doc, event);
      if (target) showDropLine(doc, target, this.draggingId);
      else clearDropLine(doc);
    },

    /** Whether what is being dragged lands in the preview: an element. */
    isPreviewDrag() {
      return Boolean(this.draggingType || this.draggingId);
    },

    // Leaving the iframe entirely, rather than crossing between two elements:
    // `relatedTarget` is null (or outside the document) only for the former.
    //
    // Firefox leaves `relatedTarget` null on `dragleave` more often than that,
    // so crossing an element boundary there clears the indicator — and the
    // very next `dragover` puts it back. A frame of flicker at worst; doing
    // better means counting enters and leaves, which is its own source of
    // stuck state.
    handlePreviewDragLeave(event) {
      const leaving = event.relatedTarget;
      const doc = this.previewDocument();
      if (!doc) return;
      if (leaving && doc.contains(leaving)) return;
      clearDropLine(doc);
    },

    // Lands where the last dragover's line said (see setDropTarget): a drop
    // always comes after one.
    handlePreviewDrop(event) {
      event.preventDefault();
      if (!this.isPreviewDrag()) return;

      const target = this.dropTarget;
      const type = this.draggingType;
      const id = this.draggingId;

      // Ended as a drop, not a cancel: the selection goes to what moved.
      this.draggingId = null;
      this.handleDragEnd();

      // A move needs the column it aims at. An insertion lands even without
      // one — a preview with no column to aim at, after the last row was
      // deleted: in the active column, which makes a row if there is none.
      if (id) {
        if (this.canDropInto(target)) this.moveElement(id, target);
      } else {
        this.insertElement(type, target);
      }
    },
  },
};

module.exports = { DragSurfaceMixin, DRAG_TYPE };
