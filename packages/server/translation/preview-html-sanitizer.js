'use strict';

/**
 * Sanitizer for translated preview HTML.
 *
 * The translation pipeline replaces original texts with the LLM/DeepL provider
 * response inside the rendered previewHtml (see preview-html-updater.js). That
 * provider output is UNTRUSTED: a model can return markup (e.g.
 * `<img src=x onerror=...>`) spontaneously or via prompt injection from the
 * email content. The resulting previewHtml is later stored and served as
 * `text/html` (mailing.controller previewHtml → res.send), so unsanitized
 * provider output is a stored-XSS sink.
 *
 * We never trust LLM output as HTML. This re-sanitizes the FINAL previewHtml
 * with DOMPurify before it is persisted, which is context-aware (unlike the
 * regex-based updater) and strips scripts, event handlers and dangerous URLs
 * while keeping the email-safe structure (tables, inline styles, images...).
 */

const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');
const logger = require('../utils/logger.js');

// One jsdom window for the whole process — instantiating a window per call is
// expensive. DOMPurify is stateless across sanitize() calls so the shared
// instance is safe.
const { window } = new JSDOM('');
const DOMPurify = createDOMPurify(window);

// Email previews are whole documents (<html><head><style>...</head><body>...).
// Keep the document structure and inline <style>, but drop anything scriptable.
const SANITIZE_CONFIG = {
  WHOLE_DOCUMENT: true,
  // Defense in depth on top of DOMPurify's defaults — these must never survive
  // in a preview that originates partly from provider output.
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'base', 'form'],
  FORBID_ATTR: ['srcset', 'formaction'],
  ADD_ATTR: ['target'],
};

/**
 * Sanitize translated preview HTML before storage.
 * Returns the sanitized HTML, or the original input unchanged if sanitization
 * fails for any reason (the caller already wraps the preview update in a
 * try/catch that degrades gracefully, and an empty preview would be worse than
 * a logged failure — but we never persist on a hard error here).
 *
 * @param {string} previewHtml
 * @returns {string}
 */
function sanitizePreviewHtml(previewHtml) {
  if (!previewHtml || typeof previewHtml !== 'string') {
    return previewHtml;
  }
  try {
    return DOMPurify.sanitize(previewHtml, SANITIZE_CONFIG);
  } catch (error) {
    logger.error(`[Translation] preview sanitization failed: ${error.message}`);
    throw error;
  }
}

module.exports = { sanitizePreviewHtml };
