'use strict';

// How /api/images hands a file of the storage to a browser.
//
// These answers are public on purpose (sent emails load them) and come from
// the application's own origin. A raster image is shown inline, where emails
// and the editor load it. Every other file, an SVG included, is downloaded
// when opened directly, never shown as a page of the application, and its
// answer carries a sandboxed policy. An <img> ignores both headers, so an SVG
// still displays in one. And the browser never guesses another type than the
// one announced.

// Self-contained SVGs keep their inline styles and embedded pictures; nothing
// else loads, and the document is sandboxed.
const SANDBOXED_DOCUMENT =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; sandbox";

const UNKNOWN_TYPE = 'application/octet-stream';

/**
 * Whether a type is shown inline: an image, but not a document (SVG, or any
 * XML-based format), which a browser shows as a page.
 *
 * @param {string|false|undefined} contentType
 * @returns {boolean}
 */
const isInlineImage = (contentType) =>
  typeof contentType === 'string' &&
  contentType.startsWith('image/') &&
  !/svg|xml/i.test(contentType);

/**
 * Express middleware: the announced type is the only one the browser uses.
 */
function noSniff(_req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  next();
}

/**
 * The type of a stored file, and, unless it is an image shown inline, the
 * headers that make it a sandboxed download.
 *
 * @param {Object} res
 * @param {string|false|undefined} contentType what the file was found to be
 */
function setServedFileHeaders(res, contentType) {
  res.set('Content-Type', contentType || UNKNOWN_TYPE);
  if (isInlineImage(contentType)) return;
  res.set('Content-Disposition', 'attachment');
  res.set('Content-Security-Policy', SANDBOXED_DOCUMENT);
}

module.exports = { noSniff, setServedFileHeaders, isInlineImage };
