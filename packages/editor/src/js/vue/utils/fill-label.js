'use strict';

/**
 * Put an image's label in a translated string, wherever it says `__label__`.
 *
 * Not through Mosaico's `t(key, params)`: it substitutes with
 * `String.replace` and a string, which reads `$&`, `` $` `` and `$'` in the
 * replacement as patterns. A label is free text, so a dialog asking to delete
 * one image could name another. A replacement function is taken literally.
 *
 * @param {string} template the translated string
 * @param {string} label
 * @returns {string}
 */
function fillLabel(template, label) {
  return String(template || '').replace(/__label__/g, () => label);
}

module.exports = { fillLabel };
