'use strict';

const { Forbidden } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');

// Server-side guards for the per-mailing head CSS: its size, and whether the
// template allows it at all.
//
// Same reasoning as html-code-block-guard.js, for the same reasons: the editor
// checks both, but the route accepts hand-written requests, and `previewHtml`
// stores a second copy of whatever is injected in the same document.
//
// The permission reuses `htmlBlockEnabled` rather than adding a flag of its own.
// Head CSS exists to style markup the user pasted in an HTML code block — a
// company without that block has nothing for this CSS to style, and would gain
// only the ability to restyle the whole email from outside the design system.
// If the two ever need to be granted separately, splitting the flag is an
// addition, not a migration.

// A stylesheet is far more compact than the markup it styles. This bound is
// generous for responsive email CSS and keeps the stored copy — doubled by
// `previewHtml` — negligible against Mongo's 16MB per-document limit.
const HEAD_CSS_MAX_LENGTH = 20000;

/**
 * @param {*} css
 * @returns {string} the CSS, or an empty string for anything that is not one
 */
function asCss(css) {
  return typeof css === 'string' ? css : '';
}

/**
 * @param {*} css
 * @param {number} [maxLength]
 * @returns {{ valid: boolean, length: number, maxLength: number }}
 */
function validateHeadCss(css, maxLength) {
  const limit = typeof maxLength === 'number' ? maxLength : HEAD_CSS_MAX_LENGTH;
  const length = asCss(css).length;
  return { valid: length <= limit, length, maxLength: limit };
}

/**
 * Whether the request brings head CSS the template does not allow.
 *
 * With the flag on, anything goes. With it off, CSS is refused unless it is
 * already stored on the mailing, character for character. A super admin turning
 * the flag off must not lock an author out of their own email: they can still
 * save it, and still clear the CSS — they just cannot write new CSS through a
 * template that does not allow it.
 *
 * Clearing is always accepted: empty CSS injects nothing and exports nothing.
 *
 * @param {Object} params
 * @param {*} params.css the CSS about to be written
 * @param {*} [params.previousCss] the CSS currently stored
 * @param {boolean} params.htmlBlockEnabled the template flag
 * @returns {boolean}
 */
function bringsDisallowedHeadCss({ css, previousCss, htmlBlockEnabled }) {
  if (htmlBlockEnabled) return false;

  const next = asCss(css);
  if (next.trim() === '') return false;

  return next !== asCss(previousCss);
}

/**
 * Throws when the request brings head CSS the template does not allow.
 *
 * @param {Object} params see bringsDisallowedHeadCss
 * @throws {Forbidden} HTML_CODE_BLOCK_DISABLED
 */
function assertHeadCssAllowed(params) {
  if (bringsDisallowedHeadCss(params)) {
    throw new Forbidden(ERROR_CODES.HTML_CODE_BLOCK_DISABLED);
  }
}

/**
 * Whether a request carries head CSS at all. Lets callers skip loading the
 * template flag when there is nothing to check.
 *
 * @param {*} css
 * @returns {boolean}
 */
function hasHeadCss(css) {
  return asCss(css).trim() !== '';
}

module.exports = {
  validateHeadCss,
  bringsDisallowedHeadCss,
  assertHeadCssAllowed,
  hasHeadCss,
  HEAD_CSS_MAX_LENGTH,
};
