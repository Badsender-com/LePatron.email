'use strict';

// The user-facing name of a gallery image.
//
// Two paths write `files.$.label`: an upload seeds it from the file name the
// browser supplied, and the rename endpoint takes it from a request body. Both
// go through here, so one cannot accept what the other rejects — the asymmetry
// that let an upload store a label its own rename endpoint would refuse.
//
// Pure, no Node builtins — the editor bundles this through browserify.

const MAX_LABEL_LENGTH = 255;

// Control characters have no place in a single-line caption, and the bidi
// overrides are worse than cosmetic: U+202E reverses what follows it, so a file
// named with one can render its extension backwards. Strip both.
//
// U+0009 to U+000D are deliberately left in: they are whitespace, so the
// collapse below turns them into a single space. Removing them outright would
// weld "line1<LF>line2" into "line1line2".
//
// Built from a string rather than written as a regex literal so the escapes
// stay escapes: prettier rewrites a literal's \u sequences into the raw,
// invisible characters they denote.
const UNSAFE_CHARS = new RegExp(
  '[\\u0000-\\u0008\\u000E-\\u001F\\u007F-\\u009F' + // controls, minus whitespace
    '\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069]', // bidi marks and overrides
  'g'
);

const EXTENSION = /\.([a-z0-9]+)$/i;

/**
 * @param {unknown} value
 * @returns {string} a label safe to store and display; '' when nothing is left
 */
function sanitizeLabel(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(UNSAFE_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LABEL_LENGTH);
}

/**
 * Build the label of a freshly uploaded image.
 *
 * `storedName` is `<mongoId>-<hash>.<ext>`, where the extension is the one the
 * server resolved by sniffing the content. That can contradict what the client
 * named the file — an upload called `photo.bin` really being a PNG — and the
 * label should say what the image is, so it follows the resolved extension.
 *
 * @param {string} storedName the name the file is stored under
 * @param {string} [uploadedName] the name the browser sent, before slugging
 * @returns {string}
 */
function labelForUpload(storedName, uploadedName) {
  const clean = sanitizeLabel(uploadedName);
  if (!clean) return storedName;

  const storedExt = EXTENSION.exec(storedName);
  if (!storedExt) return clean;

  const claimedExt = EXTENSION.exec(clean);
  if (
    claimedExt &&
    claimedExt[1].toLowerCase() === storedExt[1].toLowerCase()
  ) {
    return clean;
  }

  const base = claimedExt ? clean.slice(0, -claimedExt[0].length) : clean;
  // re-cap: swapping the extension can push a 255-char name over the limit
  return sanitizeLabel(`${base}.${storedExt[1].toLowerCase()}`);
}

module.exports = {
  sanitizeLabel,
  labelForUpload,
  MAX_LABEL_LENGTH,
};
