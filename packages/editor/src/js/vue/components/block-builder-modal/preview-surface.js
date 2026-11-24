'use strict';

const {
  collectCss,
} = require('../../../../../../shared/block-builder/stylesheet.js');
const { forceMedia } = require('../../../ext/preview-media.js');
const {
  COLUMN_CHROME_CLASS,
  ELEMENT_ATTRIBUTE,
  STARTER_ATTRIBUTE,
} = require('../../../../../../shared/block-builder/generate.js');

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
// generic: the events below, to listen on a freshly written document and to
// dress the rows of each render; freezeRender / thawRender, to keep the rows
// still under the cursor; previewElementFromEvent, to name the element under
// it. The
// class names live here too, because this is what owns the stylesheet they
// appear in; drag-surface.js imports them.

// Marks the selected row inside the preview. Prefixed, because it lands in a
// document that also holds the user's own markup.
const SELECTED_CLASS = 'lp-bb-selected';

// Set on the body while something is being dragged.
const DRAGGING_CLASS = 'lp-bb-dragging';

// The element being moved by a drag, dimmed so the cursor is not carrying an
// invisible thing.
const MOVING_CLASS = 'lp-bb-moving';

// The column a drop would land in, while something is dragged over it.
const COLUMN_TARGET_CLASS = `${COLUMN_CHROME_CLASS}--target`;

// The insertion line: one element over the whole preview, placed at the edge
// the drop would land on (drag-surface.js), in pixels.
const DROP_LINE_ID = 'lp-bb-drop-line';
// The sheet holding what the composition derives, kept apart from the chrome
// one so a render can replace it without touching the rest.
const DERIVED_STYLE_ID = 'lp-bb-derived';
const DROP_LINE_HEIGHT = 4;

// The drop target of a block that holds nothing yet.
const EMPTY_DROP_ID = 'lp-bb-empty-drop';

// Set on the preview document once it has been written and wired up.
const PREVIEW_READY_FLAG = '__lpBlockBuilderPreview';

// Emitted on the component, with the document, each time a preview document is
// written — so another surface can listen on it without this one knowing what
// it listens for. A component event rather than a method to override: any
// number of mixins can subscribe, and their order does not matter.
const PREVIEW_READY_EVENT = 'preview-document-ready';

// Emitted the same way after every render, once the new rows are in: whatever
// another surface sets on the rendered nodes — preview chrome that the
// generated markup must never carry — is gone with the old body.
const PREVIEW_RENDERED_EVENT = 'preview-rendered';

// The preview document's own chrome. It is never exported — only the generated
// markup is — so these rules exist purely to make the surface usable.
//
// Every row gets a `height`, which on a table cell is a floor rather than a
// size — `min-height` does nothing on a <td>. An element that renders nothing
// would otherwise be zero pixels tall: impossible to click, impossible to drop
// against. The same trap as the empty block placeholder in the canvas.
//
// An image with no source yet goes further: it is a starter too (marked by the
// generator, with no words to substitute), drawn here as a grey frame with a
// picture icon, at a size that reads as "an image goes here". The icon is the
// panel's secondary grey, 4:1 on the frame — past the 3:1 asked of an icon.
//
// The insertion line is an element of its own, absolutely positioned over the
// rows: above their content, so it shows across an image too, and out of the
// flow, so the rows never shift under the cursor the way a border would make
// them. It takes no pointer events, or it would become the drop target.
//
// Colours hold to WCAG AA on the white page (docs/UX_GUIDELINES.md): the
// theme's secondary blue #265090 (8:1) for what the drag draws — the line, the
// live empty zone — and the panel's greys for the rest, #616161 (6.2:1) for
// text and #757575 (4.6:1) for outlines, against the 4.5:1 asked of text and
// the 3:1 asked of UI. The accent #00acdc is 2.65:1 on white: fine as a fill
// behind text, too faint as a line or as text.
//
// A starter — the words a blank element shows here and nowhere else — is
// faded so it reads as a placeholder, not as content. Opacity rather than a
// colour, because it has to work on the button too: at 0.6, black text on white
// comes out #666 (5.7:1), and the default button's white on black the same.
const IMAGE_ICON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'" +
  " width='48' height='48' viewBox='0 0 24 24'%3E%3Cpath fill='%23757575'" +
  " d='M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0" +
  " 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E\")";

const PREVIEW_DOCUMENT = [
  '<!DOCTYPE html><html><head><meta charset="utf-8" /><style>',
  'body{margin:0;padding:0;background:#ffffff;}',
  'table{border-collapse:collapse;}',
  'img{max-width:100%;}',
  // A row can be clicked and picked up: `grab` says the second, which a
  // pointer would not, and `grabbing` takes over once it is held.
  `[${ELEMENT_ATTRIBUTE}]{cursor:grab;height:24px;}`,
  `[${ELEMENT_ATTRIBUTE}]:active,`,
  `body.${DRAGGING_CLASS} [${ELEMENT_ATTRIBUTE}]{cursor:grabbing;}`,
  `[${STARTER_ATTRIBUTE}]>table{opacity:0.6;}`,
  `[${STARTER_ATTRIBUTE}="image"]{height:120px;`,
  `background:#eeeeee ${IMAGE_ICON} no-repeat center;}`,
  `[${STARTER_ATTRIBUTE}="image"] img{display:none;}`,
  `[${ELEMENT_ATTRIBUTE}].${SELECTED_CLASS}{`,
  'outline:2px solid #00acdc;outline-offset:-2px;}',
  // While dragging, every row shows where it begins and ends, so the insertion
  // point is read against a visible structure rather than guessed.
  `body.${DRAGGING_CLASS} [${ELEMENT_ATTRIBUTE}]:not(.${SELECTED_CLASS}){`,
  'outline:1px dashed #757575;outline-offset:-1px;}',
  `[${ELEMENT_ATTRIBUTE}].${MOVING_CLASS}{opacity:0.4;}`,
  `#${DROP_LINE_ID}{position:absolute;left:0;right:0;margin:0;`,
  `height:${DROP_LINE_HEIGHT}px;background:#265090;`,
  'pointer-events:none;z-index:2147483647;}',
  `#${EMPTY_DROP_ID}{`,
  'margin:24px;padding:32px 16px;border:2px dashed #757575;border-radius:4px;',
  'text-align:center;color:#616161;font:14px Arial,Helvetica,sans-serif;}',
  `body.${DRAGGING_CLASS} #${EMPTY_DROP_ID}{`,
  'border-color:#265090;color:#265090;}',
  // An empty column is a drop zone, at rest too, so a row just added shows:
  // dashed, with a floor so there is something to aim at. Only the empty one
  // — a column with content keeps the height of the email, or the preview
  // stops showing what will be sent. While something is being dragged, every
  // column shows its edges, and the one the drop would land in stands out.
  `.${COLUMN_CHROME_CLASS}:empty{min-height:40px;}`,
  `.${COLUMN_CHROME_CLASS}:empty,`,
  `body.${DRAGGING_CLASS} .${COLUMN_CHROME_CLASS}{`,
  'outline:1px dashed #757575;outline-offset:-1px;}',
  `body.${DRAGGING_CLASS} .${COLUMN_TARGET_CLASS}{`,
  'outline:2px solid #265090;outline-offset:-2px;}',
  '</style></head><body></body></html>',
].join('');

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
