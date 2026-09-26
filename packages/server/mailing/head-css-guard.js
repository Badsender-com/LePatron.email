'use strict';

const { Forbidden } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');
const { findSyntheticBlocks } = require('./synthetic-block-guard.js');
const { HEAD_CSS_MAX_LENGTH } = require('../../shared/head-css/constants.js');

// Server-side guards for the per-mailing head CSS: its size, and whether the
// template allows it at all.
//
// Same reasoning as synthetic-block-guard.js, for the same reasons: the editor
// checks both, but the route accepts hand-written requests, and `previewHtml`
// stores a second copy of whatever is injected in the same document.
//
// The permission reuses `htmlBlockEnabled` rather than adding a flag of its own.
// Head CSS exists to style markup the user pasted in an HTML code block — a
// company without that block has nothing for this CSS to style, and would gain
// only the ability to restyle the whole email from outside the design system.
// If the two ever need to be granted separately, splitting the flag is an
// addition, not a migration.

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
 * Whether the template lets its mailings carry head CSS. The one server-side
 * place that knows which flag gates it; the editor's counterpart is
 * `viewModel.isHeadCssEditable`
 * (packages/editor/src/js/ext/head-css/view-model.js).
 *
 * @param {{ htmlBlockEnabled?: boolean }|null} [template]
 * @returns {boolean}
 */
function isHeadCssEnabled(template) {
  return Boolean(template && template.htmlBlockEnabled);
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
 * @param {boolean} params.headCssEnabled see isHeadCssEnabled
 * @returns {boolean}
 */
function bringsDisallowedHeadCss({ css, previousCss, headCssEnabled }) {
  if (headCssEnabled) return false;

  const next = asCss(css);
  if (next.trim() === '') return false;

  return next !== asCss(previousCss);
}

/**
 * Throws when the request brings head CSS the template does not allow.
 *
 * @param {Object} params see bringsDisallowedHeadCss
 * @throws {Forbidden} HEAD_CSS_DISABLED — its own code rather than the HTML
 *   code block's, although the flag is shared: the refusal is about the CSS, and
 *   the editor says so.
 */
function assertHeadCssAllowed(params) {
  if (bringsDisallowedHeadCss(params)) {
    throw new Forbidden(ERROR_CODES.HEAD_CSS_DISABLED);
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

// The HTML code block only, not the builder's: that one writes its own styles
// inline, and has nothing for this stylesheet to style.
const HTML_CODE_BLOCK_TYPE = 'htmlCodeBlock';

/**
 * The CSS a stored copy of the mailing must carry in its <head>: the head CSS
 * while `data` holds at least one HTML code block, nothing otherwise.
 *
 * The CSS follows the HTML code blocks, not the template flag — the editor's
 * export applies the same rule (packages/editor/src/js/ext/head-css/
 * exported-css.js), and this is its counterpart for the documents the server
 * writes itself, such as a translated copy's previewHtml. Once the last block
 * is gone the CSS has nothing left to style, so it is left out; it stays
 * stored on the mailing for when a block comes back.
 *
 * @param {Object} params
 * @param {Object} params.data the content model the copy is rendered from
 * @param {*} params.headCss the stored head CSS
 * @returns {string}
 */
function headCssToExport({ data, headCss }) {
  const hasHtmlCodeBlock = findSyntheticBlocks(data).some(
    (block) => block.type === HTML_CODE_BLOCK_TYPE
  );
  return hasHtmlCodeBlock ? asCss(headCss) : '';
}

module.exports = {
  headCssToExport,
  isHeadCssEnabled,
  validateHeadCss,
  bringsDisallowedHeadCss,
  assertHeadCssAllowed,
  hasHeadCss,
  HEAD_CSS_MAX_LENGTH,
};
