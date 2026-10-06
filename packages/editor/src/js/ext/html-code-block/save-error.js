'use strict';

// Messages for the save refusals that concern the "HTML code" block. Without
// them the user reads the generic "an error occurred while saving", with nothing
// telling them the template flag or a size limit is the reason.

const SAVE_ERROR_KEYS = Object.freeze({
  HTML_CODE_BLOCK_DISABLED: 'save-message-html-code-disabled',
  HTML_CODE_BLOCK_TOO_LARGE: 'save-message-html-code-too-large',
  PREVIEW_HTML_TOO_LARGE: 'save-message-preview-too-large',
});

/**
 * The translation key for a refused save, or null when the refusal is not one
 * of ours — the caller then shows its generic message.
 *
 * @param {Object} [jqXHR] the failed request
 * @returns {string|null}
 */
function saveErrorKeyFor(jqXHR) {
  const code =
    (jqXHR && jqXHR.responseJSON && jqXHR.responseJSON.message) || null;
  return Object.prototype.hasOwnProperty.call(SAVE_ERROR_KEYS, code)
    ? SAVE_ERROR_KEYS[code]
    : null;
}

module.exports = { saveErrorKeyFor, SAVE_ERROR_KEYS };
