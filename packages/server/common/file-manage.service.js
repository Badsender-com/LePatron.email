'use strict';

const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const chalk = require('chalk');
const formidable = require('formidable');
const probe = require('probe-image-size');

const config = require('../node.config.js');
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
  console.log('HANDLE JQUERY FILE UPLOAD');
  let file = files['files[]'];
  file = formatName(file.name);
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

  try {
    const head = Buffer.alloc(SNIFF_BYTES);
    const descriptor = fs.openSync(file.path, 'r');
    const read = fs.readSync(descriptor, head, 0, SNIFF_BYTES, 0);
    fs.closeSync(descriptor);
    const probed = probe.sync(head.subarray(0, read));
    const sniffedExtension = probed
      ? mime.extension(probed.mime) || probed.type
      : null;
    // not an image: keep whatever the declared type mapped to, so uploads that
    // legitimately aren't images keep working exactly as before
    return sniffedExtension || declaredExtension || null;
  } catch (e) {
    console.log(chalk.red('[UPLOAD] unable to sniff'), file.path, e.message);
    return declaredExtension || null;
  }
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
  streamImage,
  streamImageFromPreviews,
  list: listImages,
  parseMultipart,
  copyImages,
  writeStreamFromPath,
  writeStreamFromStream,
  writeStreamFromStreamWithPrefix,
};
