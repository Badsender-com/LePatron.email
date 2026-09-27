'use strict';

// Quality control only ever judges what the client edited, never the template
// Badsender built. These helpers answer "does this value come from the client?"
// by comparing the content model with the template's own defaults.

// A 1x1 transparent GIF: templates use it as an "empty" image value.
const TRANSPARENT_GIF =
  'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

/**
 * The pristine model of a block type, as the template declares it.
 * `viewModel.blockDefs` holds one default model per insertable block type; it
 * must be looked up by type, not by index (the HTML code block is reordered
 * into it at load time).
 * @param {Array} blockDefs - plain (ko.toJS) block definitions
 * @param {string} type - block type, e.g. "heroBlock"
 * @returns {Object|null}
 */
function getBlockDefault(blockDefs, type) {
  if (!Array.isArray(blockDefs) || !type) return null;
  return blockDefs.find((def) => def && def.type === type) || null;
}

/**
 * Whether an image value is "no image": nothing set, the transparent GIF
 * templates use as a blank, or the template's own default for that property
 * (a placeholder the client never replaced).
 * @param {*} value
 * @param {*} [templateDefault]
 * @returns {boolean}
 */
function isImageUnset(value, templateDefault) {
  if (value === null || value === undefined) return true;
  if (value === '' || value === 'none' || value === TRANSPARENT_GIF) {
    return true;
  }
  return Boolean(templateDefault) && value === templateDefault;
}

module.exports = {
  getBlockDefault,
  isImageUnset,
};
