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
// reason (packages/server/translation/preview-html-sanitizer.js).
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
