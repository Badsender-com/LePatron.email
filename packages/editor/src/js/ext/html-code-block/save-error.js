'use strict';

// Messages for the save refusals that concern the synthetic blocks. Without
// them the user reads the generic "an error occurred while saving", with nothing
// telling them the template flag or a size limit is the reason.
//
// The two blocks get two messages: a client may have the builder and not the
// HTML code block, and being told the wrong feature is disabled is worse than
// being told nothing.

const SAVE_ERROR_KEYS = Object.freeze({
  HTML_CODE_BLOCK_DISABLED: 'save-message-html-code-disabled',
  BLOCK_BUILDER_DISABLED: 'save-message-block-builder-disabled',
  HTML_CODE_BLOCK_TOO_LARGE: 'save-message-html-code-too-large',
  // Head CSS shares HTML_CODE_BLOCK_DISABLED above — one flag, one message.
  HEAD_CSS_TOO_LARGE: 'save-message-head-css-too-large',
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
