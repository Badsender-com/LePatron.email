'use strict';

// Neutralizes the pasted markup of an "HTML code" block FOR THE CANVAS PREVIEW
// ONLY. The stored value and every export path (download, test send, ESP) keep
// the markup exactly as pasted.
//
// This matters because the canvas is not an iframe: #main-wysiwyg-area lives in
// the editor's own document (the <iframe bindIframe> in main.tmpl.html is
// commented out), so pasted markup runs same-origin with the user's session.
// An `onerror` handler would execute with their rights.
//
// DOMPurify rather than a hand-rolled stripper: `<img src=x onerror>`,
// `<svg/onload>`, unquoted attributes and mutation-XSS make regex or naive DOM
// filtering unsafe, and the server already relies on DOMPurify for the very same
// reason (packages/server/utils/preview-html-sanitizer.js).
//
// DOMPurify is a global provided by the concatenated editor libs
// (see gulpfile.js mosaicoLibList), not a browserify dependency.

// Mirrors the server preview sanitizer, plus <meta>/<link>: a canvas preview has
// no business redirecting the page or pulling in a stylesheet.
const SANITIZE_CONFIG = {
  FORBID_TAGS: [
    'script',
    'iframe',
    'object',
    'embed',
    'base',
    'form',
    'meta',
    'link',
  ],
  FORBID_ATTR: ['srcset', 'formaction'],
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ADD_ATTR: ['target'],
  // No `data-*` at all, `data-bind` first among them. Knockout evaluates a
  // `data-bind` as JavaScript as soon as anything applies bindings to an ancestor
  // of the pasted nodes, and the canvas is the editor's own document.
  ALLOW_DATA_ATTR: false,
  // Every pasted `id` and `name` is prefixed with `user-content-`. The editor
  // finds its own nodes by id — the export frame, the Knockout templates
  // (bindings/script-template.js), the download form — and getElementById
  // returns the FIRST match in the document. An unprefixed pasted id could stand
  // in for any of them: bound as the export frame, it had Knockout run the pasted
  // bindings with the session of whoever saved. Canvas only: the stored markup
  // and the export keep the ids as pasted.
  SANITIZE_NAMED_PROPS: true,
};

/**
 * @param {string} html markup as pasted by the user
 * @param {Object} [purifier] DOMPurify instance; defaults to the global one.
 *   Injectable so the behaviour can be tested under jsdom.
 * @returns {string} markup safe to inject in the canvas
 */
function neutralizeHtmlForPreview(html, purifier) {
  if (!html || typeof html !== 'string') return '';

  const domPurify =
    purifier || (typeof window !== 'undefined' ? window.DOMPurify : null);

  // Never render unsanitized markup: without a sanitizer the preview shows
  // nothing rather than becoming an XSS sink. Export is unaffected.
  if (!domPurify || typeof domPurify.sanitize !== 'function') return '';

  return domPurify.sanitize(html, SANITIZE_CONFIG);
}

module.exports = { neutralizeHtmlForPreview, SANITIZE_CONFIG };
