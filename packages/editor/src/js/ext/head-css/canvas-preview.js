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

const { scopeCss } = require('./scope-css.js');

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
  // title would put a sheet it never indexed in its way. The consequence is
  // known and documented: `@media` rules in head CSS do not follow the mobile
  // toggle yet.
  doc.head.appendChild(element);
  return element;
}

/**
 * @param {Document} doc
 * @param {string} css
 */
function renderPreview(doc, css) {
  const element = ensureStyleElement(doc);
  if (!element) return;

  const scoped = scopeCss(css, CANVAS_SELECTOR);

  // `null` means the CSS could not be scoped. Leaving the previous rules in
  // place would show the author a canvas that no longer matches what they
  // typed, so the canvas goes back to the template's own styling instead.
  element.textContent = scoped === null ? '' : scoped;
}

/**
 * Mirrors `viewModel.headCss` into the canvas, and keeps it in step.
 *
 * @param {Object} viewModel
 * @param {Document} [doc]
 * @returns {Object|null} the Knockout subscription, for tests
 */
function attachHeadCssPreview(viewModel, doc) {
  const target =
    doc || (typeof global !== 'undefined' && global.document) || null;
  if (!viewModel || typeof viewModel.headCss !== 'function' || !target) {
    return null;
  }

  renderPreview(target, viewModel.headCss());

  return viewModel.headCss.subscribe(function (css) {
    renderPreview(target, css);
  });
}

// Plugin shape expected by template-loader.js: `init` runs after Knockout has
// applied its bindings, which is when the canvas exists.
const headCssPreviewPlugin = {
  viewModel: function () {},
  init: function (viewModel) {
    attachHeadCssPreview(viewModel);
  },
};

module.exports = {
  headCssPreviewPlugin,
  attachHeadCssPreview,
  renderPreview,
  CANVAS_SELECTOR,
  STYLE_ELEMENT_ID,
};
