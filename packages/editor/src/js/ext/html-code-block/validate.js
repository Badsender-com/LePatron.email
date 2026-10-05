'use strict';

const {
  HTML_CODE_MAX_LENGTH,
  BUILDER_STATE_MAX_LENGTH,
} = require('./constants.js');

/**
 * Size guard for the pasted markup.
 *
 * `mailing.data` is an unvalidated Mixed field, the body parser accepts 50MB and
 * `previewHtml` stores the rendered copy in the same document, so nothing stops
 * a paste from pushing the document past Mongo's 16MB limit — which would
 * surface as a raw Mongo error on save. Checked in the editor before writing the
 * model, and again on the server.
 *
 * @param {string} html
 * @param {number} [maxLength]
 * @returns {{ valid: boolean, length: number, maxLength: number }}
 */
function validateHtmlCodeLength(html, maxLength) {
  const limit =
    typeof maxLength === 'number' ? maxLength : HTML_CODE_MAX_LENGTH;
  const length = typeof html === 'string' ? html.length : 0;
  return { valid: length <= limit, length, maxLength: limit };
}

/**
 * The same guard for a composition, which stores its state next to its markup:
 * the server bounds both (mailing/synthetic-block-guard.js), so an oversized
 * one applied here would fail every autosave after it.
 *
 * @param {string} html the generated markup
 * @param {string} state the serialised state
 * @returns {{ valid: boolean }}
 */
function validateBlockBuilderLength(html, state) {
  const stateLength = typeof state === 'string' ? state.length : 0;
  return {
    valid:
      validateHtmlCodeLength(html).valid &&
      stateLength <= BUILDER_STATE_MAX_LENGTH,
  };
}

module.exports = { validateHtmlCodeLength, validateBlockBuilderLength };
