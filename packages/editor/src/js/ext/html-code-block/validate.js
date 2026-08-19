'use strict';

const { HTML_CODE_MAX_LENGTH } = require('./constants.js');

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

module.exports = { validateHtmlCodeLength };
