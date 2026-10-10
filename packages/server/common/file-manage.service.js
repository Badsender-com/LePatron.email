'use strict';

const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const chalk = require('chalk');
const formidable = require('formidable');
const probe = require('probe-image-size');

const config = require('../node.config.js');
const logger = require('../utils/logger.js');
const defer = require('../helpers/create-promise.js');
const formatName = require('../helpers/format-filename-for-jquery-fileupload.js');
const slugFilename = require('../helpers/slug-filename.js');

const { readFile } = fs;
// we want those methods to be as close as possible
const {
  streamImage,
  streamImageFromPreviews,
  writeStreamFromPath,
  writeStreamFromStream,
  writeStreamFromStreamWithPrefix,
  listImages,
  copyImages,
} = require(config.isAws ? '../utils/storage-s3' : '../utils/storage-local');

/// ///
// UPLOAD
/// ///

function imageToFields(fields, file) {
  if (file.size === 0) return;
  if (!file.name) return;
  fields.assets = fields.assets || {};
  fields.assets[file.originalName] = file.name;
}

function handleTemplatesUploads(fields, files, resolve) {
  // images
  // we want to store any images that have been uploaded on the current model
  if (files.images) {
    if (Array.isArray(files.images)) {
      files.images.forEach((file) => imageToFields(fields, file));
    } else {
      imageToFields(fields, files.images);
    }
  }

  // markup
  if (files.markup && files.markup.name) {
    // read content from file system
    // no worry about performance: only admin will do it
    readFile(files.markup.path).then((text) => {
      fields.markup = text;
      resolve(fields);
    });
  } else {
    resolve(fields);
  }
}

function handleEditorUpload(fields, files, resolve) {
  logger.log('Handling jQuery file upload');
  const rawFile = files['files[]'];
  const file = {
    ...formatName(rawFile.name),
    originalName: rawFile.originalName,
    uploadedName: rawFile.uploadedName,
    width: rawFile.width,
    height: rawFile.height,
  };
  // knockout jquery-fileupload binding expect this format
  resolve({ files: [file] });
}

const formatters = {
  editor: handleEditorUpload,
  templates: handleTemplatesUploads,
};

// How many bytes we read from an upload to recognise its format. Every image
// header we care about fits well within this.
const SNIFF_BYTES = 4096;

// Recognising a format needs a dozen bytes; MEASURING a JPEG needs to reach
// its SOF0 marker, which sits after APP1 — and a camera fills APP1 with an
// EXIF thumbnail of tens of kilobytes. So JPEG, and only JPEG, gets a wider
// window.
//
// Only JPEG, because `probe`'s SVG parser is quadratic in the buffer handed to
// it: it stringifies the whole thing and backtracks a `[^>]+` over it. Handing
// it 10MB of `<svg x<svg x…` blocks the event loop for over an hour — one
// request, whole server. Measured here: 128KB already costs 1.2s, and every
// doubling costs four times as much. Capping at SNIFF_BYTES keeps that path
// under a millisecond.
const JPEG_SNIFF_BYTES = 128 * 1024;

const isJpeg = (buffer) =>
  buffer.length > 3 &&
  buffer[0] === 0xff &&
  buffer[1] === 0xd8 &&
  buffer[2] === 0xff;

// types a browser sends when it has no idea: they map to an extension, so they
// look valid, but they say nothing about the content
const GENERIC_UPLOAD_TYPES = ['application/octet-stream'];

// `mime.extension()` answers `false` — not undefined — for a type it cannot
// map, and interpolating that into a filename is how production ended up with
// gallery files named `<hash>.false`. The type declared by the client is not
// trustworthy either: it is what produced `<hash>.bin` for actual PNGs. So fall
// back to the bytes, and give up on the upload when they are not an image.
function resolveUploadExtension(file) {
  const declaredExtension = mime.extension(file.type);
  // `application/octet-stream` *does* map — to `bin` — which is the other half
  // of the problem: it is what a browser sends when it doesn't know, and it is
  // how PNGs ended up stored as `.bin`. Never trust it, always look.
  if (declaredExtension && !GENERIC_UPLOAD_TYPES.includes(file.type)) {
    return declaredExtension;
  }

  const probed = sniffImage(file);
  const sniffedExtension = probed
    ? mime.extension(probed.mime) || probed.type
    : null;
  // not an image: keep whatever the declared type mapped to, so uploads that
  // legitimately aren't images keep working exactly as before
  return sniffedExtension || declaredExtension || null;
}

// Reads the start of an upload from disk. Returns an empty buffer rather than
// throwing: a file we cannot read is one we cannot describe, not a crash.
function readHead(file, bytes) {
  try {
    const head = Buffer.alloc(bytes);
    const descriptor = fs.openSync(file.path, 'r');
    const read = fs.readSync(descriptor, head, 0, bytes, 0);
    fs.closeSync(descriptor);
    return head.subarray(0, read);
  } catch (e) {
    logger.log('[UPLOAD] unable to read', file.path, e.message);
    return Buffer.alloc(0);
  }
}

// What `probe` makes of an upload's head — the format half of the question.
function sniffImage(file) {
  try {
    return probe.sync(readHead(file, SNIFF_BYTES));
  } catch (e) {
    logger.log('[UPLOAD] unable to sniff', file.path, e.message);
    return null;
  }
}

/**
 * The original dimensions of an image, read from its header.
 *
 * The one place that does this, for every caller: an upload, a feed download,
 * the backfill script. Each used to carry its own budget, which is how one of
 * them ended up handing `probe` a whole 10MB buffer.
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

// multipart/form-data
function parseMultipart(req, options) {
  const deferred = defer();

  // parse a file upload
  const form = new formidable.IncomingForm();
  const uploads = [];
  form.multiples = true;
  form.hash = 'md5';
  form.uploadDir = config.images.tmpDir;
  form.parse(req, onEnd);
  form.on('file', onFile);

  function onFile(name, file) {
    console.log('upload:', name);
    // remove empty files
    if (file.size === 0) return;
    // markup will be saved in DB
    if (name === 'markup') return;
    // put all other files in the right place (S3 || local)
    // slug every uploaded file name
    // user may put accent and/or spaces…
    let fileName = slugFilename(file.name);
    // ensure that files are having the right extension
    // (files can be uploaded with extname missing…)
    fileName = fileName.replace(path.extname(fileName), '');
    if (!fileName) return console.warn('unable to upload', file.name);
    const ext = resolveUploadExtension(file);
    if (!ext) {
      return console.warn(
        'unable to upload: unrecognised image format',
        file.name,
        file.type
      );
    }
    // What the user actually named the file, before the slug flattened its
    // spaces and its case. `originalName` below cannot carry it: it keys the
    // template assets map, and generate-preview.controller rebuilds that key
    // with slugFilename too, so the two must stay spelled the same way. The
    // gallery label reads this one instead — a search for "mon image" has to
    // find a file called "Mon Image.jpg".
    file.uploadedName = `${file.name}`;
    const dimensions = probeImageDimensions(readHead(file, JPEG_SNIFF_BYTES));
    if (dimensions) {
      file.width = dimensions.width;
      file.height = dimensions.height;
    }
    // name is only made of the file hash
    file.name = `${options.prefix}-${file.hash}.${ext}`;
    // original name is needed for templates assets (preview/other images…)
    file.originalName = `${fileName}.${ext}`;
    uploads.push(writeStreamFromPath(file));
  }

  function onEnd(err, fields, files) {
    if (err) return deferred.reject(err);
    console.log(chalk.green('form.parse', uploads.length));
    // wait all TMP files to be moved in the good location (s3 or local)
    Promise.all(uploads)
      .then(() => {
        formatters[options.formatter](fields, files, deferred.resolve);
      })
      .catch(deferred.reject);
  }

  return deferred;
}

/// ///
// EXPOSE
/// ///

module.exports = {
  resolveUploadExtension,
  probeImageDimensions,
  streamImage,
  streamImageFromPreviews,
  list: listImages,
  parseMultipart,
  copyImages,
  writeStreamFromPath,
  writeStreamFromStream,
  writeStreamFromStreamWithPrefix,
};
