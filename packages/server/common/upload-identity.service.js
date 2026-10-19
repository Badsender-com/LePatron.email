'use strict';

const fs = require('fs-extra');
const mime = require('mime-types');
const probe = require('probe-image-size');

const logger = require('../utils/logger.js');
const slugFilename = require('../helpers/slug-filename.js');

// What an upload IS, and what it is called once stored.
//
// Split out of file-manage.service.js, which owns moving bytes around; this
// file owns the questions asked of the bytes before they move. Both halves
// had grown past what is comfortable to read in one sitting, and the 300-line
// limit in AGENTS.md is the rule that says so.
//
// Nothing here trusts what the client declared: the browser's type is a hint,
// the browser's filename is free text, and both have put wrong things in
// production storage before. Every function below answers from the bytes
// where it can, and refuses rather than guesses where it cannot.

// How many bytes we read from an upload to recognise its format. Every image
// header we care about fits well within this.
const SNIFF_BYTES = 4096;

// Recognising a format needs a dozen bytes; MEASURING a JPEG needs to reach
// its SOF0 marker, which sits after APP1 — and a camera fills APP1 with an
// EXIF thumbnail of tens of kilobytes. So JPEG, and only JPEG, gets a wider
// window.
//
// Only JPEG, because the prober is only ever handed a bounded prefix: its cost
// grows with the buffer it is given, and an upload or a download is as large
// as its sender makes it.
const JPEG_SNIFF_BYTES = 128 * 1024;

const isJpeg = (buffer) =>
  buffer.length > 3 &&
  buffer[0] === 0xff &&
  buffer[1] === 0xd8 &&
  buffer[2] === 0xff;

// types a browser sends when it has no idea: they map to an extension, so they
// look valid, but they say nothing about the content
const GENERIC_UPLOAD_TYPES = ['application/octet-stream'];

// The same test `slugFilename` applies before deciding it can do nothing with
// a name. Kept in step with it on purpose: what follows exists to make sure
// that function is never handed a name it refuses.
const EXTENSION = /\.[0-9a-z]+$/i;

// `mime.extension()` answers `false` — not undefined — for a type it cannot
// map, and interpolating that into a filename is how production ended up with
// gallery files named `<hash>.false`. The type declared by the client is not
// trustworthy either: it is what produced `<hash>.bin` for actual PNGs. So fall
// back to the bytes, and give up on the upload when they are not an image.
//
// `head` is the start of the upload when the caller has already read it;
// without it, it is read here.
function resolveUploadExtension(file, head) {
  const declaredExtension = mime.extension(file.type);
  // `application/octet-stream` *does* map — to `bin` — which is the other half
  // of the problem: it is what a browser sends when it doesn't know, and it is
  // how PNGs ended up stored as `.bin`. Never trust it, always look.
  if (declaredExtension && !GENERIC_UPLOAD_TYPES.includes(file.type)) {
    return declaredExtension;
  }

  const probed = sniffHead(file, head || readHead(file, SNIFF_BYTES));
  const sniffedExtension = probed
    ? mime.extension(probed.mime) || probed.type
    : null;
  // not an image: keep whatever the declared type mapped to, so uploads that
  // legitimately aren't images keep working exactly as before
  return sniffedExtension || declaredExtension || null;
}

// Reads up to `bytes` of an upload from disk, from `position` on (its start
// by default). Returns an empty buffer rather than throwing: a file we cannot
// read is one we cannot describe, not a crash.
function readHead(file, bytes, position = 0) {
  try {
    const head = Buffer.alloc(bytes);
    const descriptor = fs.openSync(file.path, 'r');
    const read = fs.readSync(descriptor, head, 0, bytes, position);
    fs.closeSync(descriptor);
    return head.subarray(0, read);
  } catch (e) {
    logger.log('[UPLOAD] unable to read', file.path, e.message);
    return Buffer.alloc(0);
  }
}

// What `probe` makes of an upload's head — the format half of the question.
function sniffHead(file, head) {
  try {
    return probe.sync(head);
  } catch (e) {
    logger.log('[UPLOAD] unable to sniff', file.path, e.message);
    return null;
  }
}

/**
 * The original dimensions of an image, read from its header.
 *
 * The one place that does this, for every caller: an upload, a feed download,
 * the backfill script. Each used to carry its own budget; here, the bound on
 * what the prober reads is the same for all of them.
 *
 * Never throws: a header it cannot read is a tooltip line that is not shown,
 * not a failed upload.
 *
 * @param {Buffer} buffer the start of the file; more than the window is fine
 * @returns {{width: number, height: number}|null} null when not measurable
 */
function probeImageDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  try {
    const head = readDimensions(buffer.subarray(0, SNIFF_BYTES));
    if (head) return head;
    // the dimensions sat past APP1; widen, but only for a real JPEG
    if (!isJpeg(buffer)) return null;
    return readDimensions(buffer.subarray(0, JPEG_SNIFF_BYTES));
  } catch (e) {
    logger.log('[UPLOAD] unable to measure', e.message);
    return null;
  }
}

/**
 * The dimensions of an upload, from the head its caller has already read.
 *
 * A JPEG can keep them past the head, after a large APP1: only then is the
 * file read on, from where the head stopped and up to the JPEG window, so no
 * byte is read twice and anything else is read once, SNIFF_BYTES at most.
 *
 * @param {object} file a formidable upload, already written to tmp
 * @param {Buffer} head its first SNIFF_BYTES, or all of it when shorter
 * @returns {{width: number, height: number}|null}
 */
function measureUpload(file, head) {
  const dimensions = probeImageDimensions(head);
  if (dimensions || !isJpeg(head) || head.length < SNIFF_BYTES) {
    return dimensions;
  }
  const rest = readHead(file, JPEG_SNIFF_BYTES - head.length, head.length);
  return probeImageDimensions(Buffer.concat([head, rest]));
}

// `probe` reports SVG sizes as floats, and in whatever unit the document
// declared — `21 × 29.693548387096772` centimetres would otherwise be printed
// as pixels with sixteen decimals.
function readDimensions(window) {
  const probed = probe.sync(window);
  if (!probed || !probed.width || !probed.height) return null;
  const unit = probed.wUnits || 'px';
  if (unit !== 'px' || probed.hUnits !== unit) return null;
  return { width: Math.round(probed.width), height: Math.round(probed.height) };
}

/**
 * The two names an accepted upload is stored under.
 *
 * `name` is content-addressed — `<prefix>-<md5>.<ext>` — and is what the
 * gallery and every email point at. `originalName` keys the template assets
 * map, and generate-preview.controller rebuilds that key with `slugFilename`
 * too, so the two have to be spelled the same way.
 *
 * The extension comes from the bytes, not from what the client claimed, and
 * is then lent to a name that has none. That last part is not a nicety:
 * `slugFilename` answers `false` for a name with no extension, and
 * `false.replace(…)` was the next line — thrown inside formidable's `file`
 * event handler, where the process-wide `uncaughtException` net swallowed it.
 * The upload was never written and the request was never answered, so the
 * client waited forever with nothing to show for it. Relaunching the image
 * editor on a gallery file whose label had been renamed to "clepsidre"
 * reached it every single time.
 *
 * @param {object} file a formidable upload, already written to tmp
 * @param {string} prefix the mailing or template id the file belongs to
 * @param {Buffer} [head] the start of the upload, when already read
 * @returns {{name: string, originalName: string}|null} null when the upload
 *   cannot be stored at all — not an image, or nothing left of its name
 */
function resolveUploadNames(file, prefix, head) {
  const ext = resolveUploadExtension(file, head);
  if (!ext) return null;

  const claimed = EXTENSION.test(file.name) ? file.name : `${file.name}.${ext}`;
  // slug every uploaded file name — user may put accent and/or spaces…
  const slugged = slugFilename(claimed);
  if (!slugged) return null;

  // Strip the extension with the same anchored pattern, not `path.extname`:
  // that one calls a leading dot a dotfile rather than an extension and
  // answers '', and `String.replace` with '' then matches at position zero
  // and changes nothing. A name made only of punctuation came out as
  // `.png.png` instead of being refused.
  const base = slugged.replace(EXTENSION, '');
  if (!base) return null;

  return {
    name: `${prefix}-${file.hash}.${ext}`,
    originalName: `${base}.${ext}`,
  };
}

module.exports = {
  resolveUploadExtension,
  resolveUploadNames,
  probeImageDimensions,
  measureUpload,
  readHead,
  SNIFF_BYTES,
  JPEG_SNIFF_BYTES,
};
