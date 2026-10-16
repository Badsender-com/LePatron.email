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
  return dropDanglingSurrogate(
    value.replace(UNSAFE_CHARS, '').replace(/\s+/g, ' ').trim()
  ).slice(0, MAX_LABEL_LENGTH);
}

// `slice` counts UTF-16 code units, so a cut landing inside an emoji leaves a
// lone high surrogate — not valid UTF-8, and it comes back out of the database
// as a replacement character.
function dropDanglingSurrogate(value) {
  if (value.length <= MAX_LABEL_LENGTH) return value;
  const cut = value.slice(0, MAX_LABEL_LENGTH);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
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

// " (2)", " (17)" — the series a desktop file manager appends, recognised so
// that editing a copy continues the series instead of nesting inside it.
const COPY_SUFFIX = /\s\((\d+)\)$/;

/**
 * Name the copy that editing an image produces (US-10).
 *
 * Editing never replaces the original — the stored name is the md5 of the
 * content, so the result is always an additional gallery entry. Two entries
 * under one label would be indistinguishable in the grid and in a search, so
 * the copy takes the next free number in the series, the way macOS and Windows
 * both already do it.
 *
 * Numbering starts at 2: "(1)" reads as the first of a series, and the first
 * of the series is the file that has no number at all.
 *
 * @param {string} label the label of the image being edited
 * @param {Array<string>} [existingLabels] every label already in the gallery
 * @returns {string} a label no image in that list is using
 */
function nextCopyLabel(label, existingLabels) {
  const clean = sanitizeLabel(label);
  if (!clean) return clean;

  const matched = EXTENSION.exec(clean);
  const extension = matched ? matched[0] : '';
  const base = (extension ? clean.slice(0, -extension.length) : clean).replace(
    COPY_SUFFIX,
    ''
  );

  // Case-folded: two labels differing only in case are indistinguishable at a
  // glance, which is the whole thing this avoids.
  const taken = new Set(
    (existingLabels || []).map((value) => String(value).toLowerCase())
  );

  // At most one more candidate than there are labels can be taken, so this
  // terminates without needing an arbitrary ceiling.
  for (let n = 2; n <= taken.size + 2; n++) {
    const candidate = withinLimit(base, ` (${n})${extension}`);
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  // unreachable: the loop runs one past the number of labels that can collide
  return withinLimit(base, ` (${taken.size + 2})${extension}`);
}

// Cut a string to at most `length` UTF-16 code units without splitting a
// surrogate pair: `slice` counts code units, so a cut inside an emoji would
// leave a lone high surrogate, which comes back from the database as a
// replacement character.
function trimTo(value, length) {
  if (value.length <= length) return value;
  const cut = value.slice(0, length);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

// A 255-character label plus " (2).png" is no longer a 255-character label.
// The base gives way, not the suffix: the number is what makes the name
// unique, and the extension is what says what the file is. Every branch stays
// within the cap — including the pathological one where the "extension" alone
// is longer than the cap — so the name this returns is the name the server's
// own `sanitizeLabel` would keep, and the uniqueness check above is not made
// against a string that storage would then truncate to something else.
function withinLimit(base, suffix) {
  const room = MAX_LABEL_LENGTH - suffix.length;
  if (room <= 0) return trimTo(`${base}${suffix}`, MAX_LABEL_LENGTH);
  if (base.length <= room) return `${base}${suffix}`;
  return `${trimTo(base, room).trim()}${suffix}`;
}

module.exports = {
  sanitizeLabel,
  labelForUpload,
  nextCopyLabel,
  MAX_LABEL_LENGTH,
};
