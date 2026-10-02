'use strict';

// Applies the author's head CSS to the canvas, so writing a rule shows its
// effect where the email is being composed rather than only in the export.
//
// The canvas is a plain div of the editor's document (`#main-wysiwyg-area`),
// not an iframe, so the stylesheet is added to that document and every selector
// is scoped to the area — otherwise the rules would also restyle the toolbox,
// the panels and the dialogs. See scope-css.js.
//
// What this is NOT: the source of truth for the export. The export injects the
// CSS verbatim from packages/shared/head-css, untouched by any of this. If the
// scoping ever gets a selector wrong, the canvas is wrong and the delivered
// email is still right.
//
// It does follow the export's rule, though: the canvas shows the CSS only when
// the export would carry it, that is while the mailing holds an HTML code block
// (exported-css.js). A stylesheet still styling the canvas after the last block
// is gone would show the author an email they will not send.

const ko = require('knockout');
const { scopeCss } = require('./scope-css.js');
const { previewMediaFor } = require('../preview-media.js');

const CANVAS_SELECTOR = '#main-wysiwyg-area';
const STYLE_ELEMENT_ID = 'lp-head-css-preview';

/**
 * The <style> holding the scoped copy, created on first use.
 *
 * @param {Document} doc
 * @returns {HTMLStyleElement|null}
 */
function ensureStyleElement(doc) {
  if (!doc || !doc.head) return null;

  const existing = doc.getElementById(STYLE_ELEMENT_ID);
  if (existing) return existing;

  const element = doc.createElement('style');
  element.setAttribute('id', STYLE_ELEMENT_ID);
  element.setAttribute('type', 'text/css');
  // Deliberately NOT `title="template-stylesheet"`: that title is what
  // badsender-screen-preview.js walks to rewrite media queries on the mobile
  // toggle, and it rebuilds its index only when a template loads. Claiming the
  // title would put a sheet it never indexed in its way. This sheet follows
  // the toggle on its own, by being regenerated: see attachHeadCssPreview.
  doc.head.appendChild(element);
  return element;
}

/**
 * @param {Document} doc
 * @param {string} css
 * @param {string} [previewMode] `desktop`, `mobile` or `both`
 */
function renderPreview(doc, css, previewMode) {
  const element = ensureStyleElement(doc);
  if (!element) return;

  // Media queries follow the preview mode exactly as the template's do.
  const scoped = scopeCss(css, CANVAS_SELECTOR, previewMediaFor(previewMode));

  // `null` means the CSS could not be scoped. Leaving the previous rules in
  // place would show the author a canvas that no longer matches what they
  // typed, so the canvas goes back to the template's own styling instead.
  element.textContent = scoped === null ? '' : scoped;
}

/**
 * Mirrors the exported head CSS (`viewModel.exportedHeadCss`) into the
 * canvas, and keeps it in step.
 *
 * @param {Object} viewModel
 * @param {Document} [doc]
 * @returns {{ dispose: Function }|null} stops following the view model and
 *   removes the canvas copy; null when there is nothing to follow
 */
function attachHeadCssPreview(viewModel, doc) {
  const target =
    doc || (typeof global !== 'undefined' && global.document) || null;
  if (
    !viewModel ||
    typeof viewModel.exportedHeadCss !== 'function' ||
    !target
  ) {
    return null;
  }

  // One computed over what the export would inject: it depends on the stored
  // CSS and on the presence of an HTML code block, so adding, removing or
  // undoing the last block re-renders the canvas — and, pure, it notifies only
  // when that CSS actually changes, not on every edit of the content.
  const exported = ko.pureComputed(() => viewModel.exportedHeadCss());

  const currentMode = () =>
    typeof viewModel.previewMode === 'function'
      ? viewModel.previewMode()
      : undefined;

  const render = () => renderPreview(target, exported(), currentMode());

  render();

  // Re-rendered from the source on every change rather than rewritten in the
  // CSSOM the way badsender-screen-preview.js does for the template. That
  // module builds its index of media rules once, when a template loads; this
  // sheet is replaced on every "Apply", every undo, every preview mode change
  // and whenever the last HTML code block goes or comes back, so it could
  // never stay in such an index. Regenerating is both simpler and correct by
  // construction.
  const subscriptions = [exported.subscribe(render)];
  if (typeof viewModel.previewMode === 'function') {
    subscriptions.push(viewModel.previewMode.subscribe(render));
  }

  return {
    dispose() {
      subscriptions.forEach((subscription) => subscription.dispose());
      exported.dispose();
      const element = target.getElementById
        ? target.getElementById(STYLE_ELEMENT_ID)
        : null;
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    },
  };
}

// A view model plugin (template-loader.js #_viewModelPluginInstance): `init`
// runs after Knockout has applied its bindings, which is when the canvas
// exists, and `dispose` when the editor is torn down — without it, the
// subscriptions outlived the view model and its rules stayed in the document.
function headCssPreviewPlugin(viewModel) {
  let attachment = null;
  return {
    init() {
      attachment = attachHeadCssPreview(viewModel);
    },
    dispose() {
      if (attachment) attachment.dispose();
      attachment = null;
    },
  };
}

module.exports = {
  headCssPreviewPlugin,
  attachHeadCssPreview,
  renderPreview,
  CANVAS_SELECTOR,
  STYLE_ELEMENT_ID,
};
