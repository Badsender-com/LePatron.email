'use strict';

const {
  ELEMENT_ATTRIBUTE,
} = require('../../../../../../shared/block-builder/generate.js');

// The preview: an iframe that shows the block, and the surface the user edits on.
//
// A Vue 2 mixin rather than a module of functions, because every one of these
// needs the component's state — what is composed, what is selected, whether a
// drag is under way. A mixin keeps `this` meaning what it means in the
// component, which a module of helpers taking `this` as a parameter would not.
//
// Two properties of this surface drive everything here. It is an IFRAME, so the
// template's own stylesheet cannot reach in and the block sits at its real
// width; and it is SAME-ORIGIN (no `src`, and `sandbox` keeps
// `allow-same-origin`), so the parent can write into it and listen on it even
// though scripts inside it cannot run.
//
// The class names live here rather than with the dragging, because this is what
// owns the stylesheet they appear in. drag-surface.js imports them.

// Marks the selected row inside the preview. Prefixed, because it lands in a
// document that also holds the user's own markup.
const SELECTED_CLASS = 'lp-bb-selected';

// Set on the body while something is being dragged, and on the row the drop
// would land against.
const DRAGGING_CLASS = 'lp-bb-dragging';
const DROP_BEFORE_CLASS = 'lp-bb-drop-before';
const DROP_AFTER_CLASS = 'lp-bb-drop-after';

// The row currently being moved, dimmed so the cursor is not carrying an
// invisible thing.
const MOVING_CLASS = 'lp-bb-moving';

// The drop target of a block that holds nothing yet.
const EMPTY_DROP_ID = 'lp-bb-empty-drop';

// Set on the preview document once it has been written and wired up.
const PREVIEW_READY_FLAG = '__lpBlockBuilderPreview';

// The preview document's own chrome. It is never exported — only the generated
// markup is — so these rules exist purely to make the surface usable.
//
// `min-height` matters more than it looks: an element dropped before it holds
// anything (an image with no source yet) renders nothing at all, so without it
// the row is zero pixels tall and cannot be clicked. The same trap as the empty
// block placeholder in the canvas.
//
// The insertion line is an inset box-shadow rather than a border: a border
// would change the row's height mid-drag and make the rows shift under the
// cursor.
const PREVIEW_DOCUMENT = [
  '<!DOCTYPE html><html><head><meta charset="utf-8" /><style>',
  'body{margin:0;padding:0;background:#ffffff;}',
  'table{border-collapse:collapse;}',
  'img{max-width:100%;}',
  `[${ELEMENT_ATTRIBUTE}]{cursor:pointer;min-height:24px;}`,
  `[${ELEMENT_ATTRIBUTE}].${SELECTED_CLASS}{`,
  'outline:2px solid #00acdc;outline-offset:-2px;}',
  // While dragging, every row shows where it begins and ends, so the insertion
  // point is read against a visible structure rather than guessed.
  `body.${DRAGGING_CLASS} [${ELEMENT_ATTRIBUTE}]:not(.${SELECTED_CLASS}){`,
  'outline:1px dashed #b5b5b5;outline-offset:-1px;}',
  `[${ELEMENT_ATTRIBUTE}].${DROP_BEFORE_CLASS}{`,
  'box-shadow:inset 0 3px 0 0 #00acdc;}',
  `[${ELEMENT_ATTRIBUTE}].${DROP_AFTER_CLASS}{`,
  'box-shadow:inset 0 -3px 0 0 #00acdc;}',
  `#${EMPTY_DROP_ID}{`,
  'margin:24px;padding:32px 16px;border:2px dashed #c7c7c7;border-radius:4px;',
  'text-align:center;color:#8c8c8c;font:14px Arial,Helvetica,sans-serif;}',
  `body.${DRAGGING_CLASS} #${EMPTY_DROP_ID}{`,
  'border-color:#00acdc;color:#00acdc;}',
  `[${ELEMENT_ATTRIBUTE}].${MOVING_CLASS}{opacity:0.4;}`,
  '</style></head><body></body></html>',
].join('');

const PreviewSurfaceMixin = {
  methods: {
    scheduleRender() {
      // Replacing the body mid-drag destroys the very nodes the cursor is over:
      // the drop target vanishes, and the drag ends on nothing. Held until the
      // drag is done, then rendered once.
      if (this.isDragging()) {
        this.renderHeldDuringDrag = true;
        return;
      }
      if (this.frameRequest) return;
      this.frameRequest = window.requestAnimationFrame(() => {
        this.frameRequest = null;
        this.renderPreview();
      });
    },

    // The preview document, written once and then only ever refilled.
    //
    // Guarded by a flag on the document rather than by `!doc.body`: a fresh
    // src-less iframe is already at about:blank *with* an empty body, so that
    // test skipped the write — and with it the stylesheet. The flag disappears
    // with the document, and the modal destroys its content on close
    // (`v-if="isOpen"`), so a reopened modal writes a new one.
    ensurePreviewDocument() {
      const frame = this.$refs.previewFrame;
      if (!frame || !frame.contentDocument) return null;
      if (frame.contentDocument[PREVIEW_READY_FLAG]) {
        return frame.contentDocument;
      }

      frame.contentDocument.open();
      frame.contentDocument.write(PREVIEW_DOCUMENT);
      frame.contentDocument.close();

      // Re-read it: `close()` can hand back a different document object.
      const doc = frame.contentDocument;
      doc[PREVIEW_READY_FLAG] = true;
      doc.addEventListener('click', this.handlePreviewClick);
      // `dragover` has to cancel the event on every move, or the browser
      // refuses the drop outright — the one rule of the HTML5 drag API that
      // everybody forgets.
      // Reordering starts inside the iframe, so its `dragstart` never reaches
      // the parent window — and therefore never meets Mosaico's guard, which
      // is why this one needs no stopPropagation while the palette's does.
      doc.addEventListener('dragstart', this.handlePreviewDragStart);
      doc.addEventListener('dragend', this.handleDragEnd);
      doc.addEventListener('dragenter', this.handlePreviewDragOver);
      doc.addEventListener('dragover', this.handlePreviewDragOver);
      doc.addEventListener('drop', this.handlePreviewDrop);
      doc.addEventListener('dragleave', this.handlePreviewDragLeave);
      return doc;
    },

    renderPreview() {
      const doc = this.ensurePreviewDocument();
      if (!doc || !doc.body) return;

      // Replacing the body, never the document: reloading is what makes images
      // flicker and the scroll jump.
      doc.body.innerHTML = this.previewMarkup;
      // An empty block generates nothing at all, so there would be no surface
      // to drop onto — and no way to start. This target is preview chrome: it
      // lives in the iframe only, never in what the generator produces.
      if (this.isEmpty) {
        const zone = doc.createElement('div');
        zone.id = EMPTY_DROP_ID;
        zone.textContent = this.vm.t('block-builder-drop-here');
        doc.body.appendChild(zone);
      }
      // Preview chrome, set on the nodes rather than written into the markup:
      // `draggable` has no business in an email, and the generated HTML is what
      // ships.
      this.previewRows(doc).forEach((row) => {
        row.draggable = true;
      });
      this.applySelectionHighlight();
    },

    previewRows(doc) {
      if (!doc || !doc.body) return [];
      return Array.prototype.slice.call(
        doc.body.querySelectorAll(`[${ELEMENT_ATTRIBUTE}]`)
      );
    },

    /** The preview document, only if it has already been written. */
    previewDocument() {
      const frame = this.$refs.previewFrame;
      const doc = frame && frame.contentDocument;
      return doc && doc[PREVIEW_READY_FLAG] ? doc : null;
    },

    // Selecting by clicking the rendered block, rather than only through the
    // list on the left. `closest` walks up from whatever was actually clicked —
    // a word inside a paragraph, a pixel of an image — to the row that carries
    // the element id.
    handlePreviewClick(event) {
      // The preview holds real links: a button renders an `<a href>`, and
      // clicking one would navigate the iframe away from the composition.
      event.preventDefault();

      const target = event.target;
      const row =
        target && typeof target.closest === 'function'
          ? target.closest(`[${ELEMENT_ATTRIBUTE}]`)
          : null;
      if (!row) return;

      const id = row.getAttribute(ELEMENT_ATTRIBUTE);
      if (this.state.elements.some((element) => element.id === id)) {
        this.selectedId = id;
      }
    },

    // Marks the selected row in the preview, so the selection reads the same on
    // both sides. Re-applied after every render, since replacing the body drops
    // the class with everything else.
    //
    // Compared attribute by attribute rather than through a CSS selector: the
    // id comes from stored state, which is treated as hostile everywhere else
    // (see state.js), and there are at most a handful of rows.
    applySelectionHighlight() {
      const frame = this.$refs.previewFrame;
      const doc = frame && frame.contentDocument;
      if (!doc || !doc.body) return;

      const rows = doc.body.querySelectorAll(`[${ELEMENT_ATTRIBUTE}]`);
      Array.prototype.forEach.call(rows, (row) => {
        const selected = row.getAttribute(ELEMENT_ATTRIBUTE) === this.selectedId;
        row.classList.toggle(SELECTED_CLASS, selected);
      });
    },
  },
};

module.exports = {
  PreviewSurfaceMixin,
  SELECTED_CLASS,
  DRAGGING_CLASS,
  DROP_BEFORE_CLASS,
  DROP_AFTER_CLASS,
  MOVING_CLASS,
  EMPTY_DROP_ID,
  PREVIEW_READY_FLAG,
};
