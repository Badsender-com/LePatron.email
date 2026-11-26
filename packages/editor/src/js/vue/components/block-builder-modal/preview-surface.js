'use strict';

const {
  collectCss,
} = require('../../../../../../shared/block-builder/stylesheet.js');
const { forceMedia } = require('../../../ext/preview-media.js');
const {
  ELEMENT_ATTRIBUTE,
} = require('../../../../../../shared/block-builder/generate.js');
const {
  SELECTED_CLASS,
  DRAGGING_CLASS,
  MOVING_CLASS,
  COLUMN_TARGET_CLASS,
  DROP_LINE_ID,
  DERIVED_STYLE_ID,
  DROP_LINE_HEIGHT,
  EMPTY_DROP_ID,
  PREVIEW_READY_FLAG,
  PREVIEW_READY_EVENT,
  PREVIEW_RENDERED_EVENT,
  PREVIEW_DOCUMENT,
} = require('./preview-document.js');

// The preview: an iframe that shows the block, and the surface the user edits on.
//
// A Vue 2 mixin rather than a module of functions, because every one of these
// needs the component's state — what is composed, what is selected, whether
// renders are being held. A mixin keeps `this` meaning what it means in the
// component, which a module of helpers taking `this` as a parameter would not.
//
// Two properties of this surface drive everything here. It is an IFRAME, so the
// template's own stylesheet cannot reach in and the block sits at its real
// width; and it is SAME-ORIGIN (no `src`, and `sandbox` keeps
// `allow-same-origin`), so the parent can write into it and listen on it even
// though scripts inside it cannot run.
//
// The component is expected to provide: `state`, `locateElement`,
// `selectElement`, `selectedElementId`, `isEmpty`, `previewMarkup`, `vm`,
// `previewWidth` and `mobileWidth`, and a `previewFrame` ref.
//
// It knows nothing of the drag. What the drag needs from it is public and
// generic: the events of preview-document.js, to listen on a freshly written
// document and to dress the elements of each render; freezeRender / thawRender,
// to keep them still under the cursor; previewElementFromEvent, to name the
// element under it. The document itself, its class names and those events
// live in preview-document.js; this module re-exports them.


const PreviewSurfaceMixin = {
  data: () => ({
    frameRequest: null,
    // While frozen, renders are held rather than run; `renderHeld` remembers
    // that one fell due, so thawing renders once instead of not at all.
    renderFrozen: false,
    renderHeld: false,
  }),
  watch: {
    // The toggle decides whether the composition's own stylesheet applies, so
    // it has to reach the preview. Only that sheet is rewritten: replacing the
    // body here would refetch every image on each flip of the toggle.
    previewWidth() {
      const doc = this.previewDocument();
      if (doc) this.renderDerivedCss(doc);
    },
  },
  beforeDestroy() {
    if (this.frameRequest) window.cancelAnimationFrame(this.frameRequest);
  },
  methods: {
    // Replacing the body under a gesture destroys the very nodes the cursor is
    // over: a drop target vanishes, and the drag ends on nothing. Whoever runs
    // such a gesture freezes the preview for its length.
    freezeRender() {
      this.renderFrozen = true;
    },

    // Through scheduleRender rather than straight to renderPreview: a drop
    // thaws and then changes the state in the same task, and the two renders
    // that would cost collapse into one frame.
    thawRender() {
      this.renderFrozen = false;
      if (!this.renderHeld) return;
      this.renderHeld = false;
      this.scheduleRender();
    },

    scheduleRender() {
      if (this.renderFrozen) {
        this.renderHeld = true;
        return;
      }
      if (this.frameRequest) return;
      this.frameRequest = window.requestAnimationFrame(() => {
        this.frameRequest = null;
        // Checked again here: a frame requested before the gesture began
        // still runs during it.
        if (this.renderFrozen) {
          this.renderHeld = true;
          return;
        }
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
      this.$emit(PREVIEW_READY_EVENT, doc);
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
      // lives in the iframe only, never in what the generator produces. A
      // block holding nothing but empty columns has them to drop into instead.
      if (this.previewMarkup === '') {
        const zone = doc.createElement('div');
        zone.id = EMPTY_DROP_ID;
        zone.textContent = this.vm.t('block-builder-drop-here');
        doc.body.appendChild(zone);
      }
      this.renderDerivedCss(doc);
      this.applySelectionHighlight();
      this.$emit(PREVIEW_RENDERED_EVENT, doc);
    },

    /**
     * Puts the composition's own stylesheet in the preview, under the toggle.
     *
     * Without this the preview carried the stacking CLASS and nothing that
     * defines it, so switching to Mobile shrank the columns instead of
     * stacking them — in the one place a user is told to check that.
     *
     * The stylesheet is the one the export carries for this block
     * (collectCss), treated the way the canvas treats it
     * (head-css/canvas-preview.js):
     *
     *   - Mobile: its media queries forced by the canvas's own rewrite
     *     (forceMedia, preview-media.js), so the same rule stacks the columns
     *     in both places;
     *   - Desktop: left out. The canvas keeps the condition as written there,
     *     but it evaluates it against the editor's window, wider than the
     *     breakpoint, so the rule never applies. This iframe is 600px wide,
     *     exactly the breakpoint, and `max-width` is inclusive: the condition
     *     as written would stack the desktop preview. Leaving the sheet out is
     *     what shows the canvas's desktop here.
     */
    renderDerivedCss(doc) {
      let sheet = doc.getElementById(DERIVED_STYLE_ID);
      if (!sheet) {
        sheet = doc.createElement('style');
        sheet.setAttribute('id', DERIVED_STYLE_ID);
        sheet.setAttribute('type', 'text/css');
        doc.head.appendChild(sheet);
      }
      sheet.textContent =
        this.previewWidth === this.mobileWidth
          ? forceMedia(collectCss(this.state))
          : '';
    },

    /** The rendered elements of the preview, in document order. */
    previewElements(doc) {
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

    // ---- selecting ---------------------------------------------------------

    // Selecting by clicking the rendered block, rather than only through the
    // list on the left.
    handlePreviewClick(event) {
      // The preview holds real links: a button renders an `<a href>`, and
      // clicking one would navigate the iframe away from the composition.
      event.preventDefault();

      const node = this.previewElementFromEvent(event);
      if (node) this.selectElement(node.getAttribute(ELEMENT_ATTRIBUTE));
    },

    // The rendered element an event happened in, or null: for the click above
    // and the drag (drag-surface.js) alike. `closest` walks up from whatever
    // was hit — a word, a pixel of an image — to the node that carries the
    // id; a target with no `closest` is a text node, a selection being
    // dragged. An id that is nowhere in the composition — any row, any
    // column — is not ours.
    previewElementFromEvent(event) {
      const target = event.target;
      const node =
        target && typeof target.closest === 'function'
          ? target.closest(`[${ELEMENT_ATTRIBUTE}]`)
          : null;
      if (!node) return null;
      return this.locateElement(node.getAttribute(ELEMENT_ATTRIBUTE))
        ? node
        : null;
    },

    // Marks the selected element in the preview, so the selection reads the same on
    // both sides. Re-applied after every render, since replacing the body drops
    // the class with everything else.
    //
    // Compared attribute by attribute rather than through a CSS selector: the
    // id comes from stored state, which is treated as hostile everywhere else
    // (see state.js), and there are at most a handful of elements.
    applySelectionHighlight() {
      const frame = this.$refs.previewFrame;
      this.previewElements(frame && frame.contentDocument).forEach((node) => {
        const selected =
          node.getAttribute(ELEMENT_ATTRIBUTE) === this.selectedElementId;
        node.classList.toggle(SELECTED_CLASS, selected);
      });
    },
  },
};

module.exports = {
  PreviewSurfaceMixin,
  SELECTED_CLASS,
  DRAGGING_CLASS,
  DROP_LINE_ID,
  DERIVED_STYLE_ID,
  DROP_LINE_HEIGHT,
  MOVING_CLASS,
  COLUMN_TARGET_CLASS,
  EMPTY_DROP_ID,
  PREVIEW_READY_EVENT,
  PREVIEW_RENDERED_EVENT,
};
