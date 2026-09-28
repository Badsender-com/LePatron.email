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
// The component is expected to provide: `state`, `selectedId`, `isEmpty`,
// `previewMarkup`, `frameRequest`, `vm`, and a `previewFrame` ref.

// Marks the selected row inside the preview. Prefixed, because it lands in a
// document that also holds the user's own markup.
const SELECTED_CLASS = 'lp-bb-selected';

// Set on the preview document once it has been written and wired up.
const PREVIEW_READY_FLAG = '__lpBlockBuilderPreview';

// The preview document's own chrome. It is never exported — only the generated
// markup is — so these rules exist purely to make the surface usable: no body
// margin so the block sits at the real template width, and an outline plus a
// pointer cursor so the rows read as clickable.
const PREVIEW_DOCUMENT = [
  '<!DOCTYPE html><html><head><meta charset="utf-8" /><style>',
  'body{margin:0;padding:0;background:#ffffff;}',
  'table{border-collapse:collapse;}',
  'img{max-width:100%;}',
  `[${ELEMENT_ATTRIBUTE}]{cursor:pointer;}`,
  `[${ELEMENT_ATTRIBUTE}].${SELECTED_CLASS}{`,
  'outline:2px solid #00acdc;outline-offset:-2px;}',
  '</style></head><body></body></html>',
].join('');
const PreviewSurfaceMixin = {
  methods: {
    scheduleRender() {
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
      return doc;
    },

    renderPreview() {
      const doc = this.ensurePreviewDocument();
      if (!doc || !doc.body) return;

      // Replacing the body, never the document: reloading is what makes images
      // flicker and the scroll jump.
      doc.body.innerHTML = this.previewMarkup;
      this.applySelectionHighlight();
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
  PREVIEW_READY_FLAG,
};
