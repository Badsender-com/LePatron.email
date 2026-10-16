'use strict';

const fs = require('fs-extra');
const formidable = require('formidable');
const createError = require('http-errors');

const config = require('../node.config.js');
const logger = require('../utils/logger.js');
const ERROR_CODES = require('../constant/error-codes.js');
const defer = require('../helpers/create-promise.js');
const formatName = require('../helpers/format-filename-for-jquery-fileupload.js');
const {
  resolveUploadNames,
  probeImageDimensions,
  readHead,
  JPEG_SNIFF_BYTES,
} = require('./upload-identity.service.js');

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

function handleTemplatesUploads(fields, files, resolve, reject) {
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
    //
    // A rejected read must reject the deferred, not be dropped: without the
    // `.catch`, a markup file that cannot be read would leave `resolve` uncalled
    // and the request hanging forever — the same failure the editor path had.
    readFile(files.markup.path)
      .then((text) => {
        fields.markup = text;
        resolve(fields);
      })
      .catch(reject);
  } else {
    resolve(fields);
  }
}

function handleEditorUpload(fields, files, resolve, reject) {
  logger.log('Handling jQuery file upload');
  const rawFile = files['files[]'];
  // `onFile` sets `uploadedName` on everything it stores, and nothing else
  // does. Without it the bytes never reached storage — the upload was not an
  // image, or nothing could be made of its name — and answering with a
  // formatted name would put a gallery entry in front of a file that does
  // not exist: a thumbnail that 404s, for good, with no sign anything went
  // wrong. Say no instead.
  if (!rawFile || !rawFile.uploadedName) {
    return reject(
      new createError.UnprocessableEntity(ERROR_CODES.UPLOAD_NOT_STORED)
    );
  }
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

  // formidable emits `file` synchronously from the request's `data` handler,
  // so a throw here escapes into no promise at all — it was caught by the
  // process-wide `uncaughtException` net, which let the process live while the
  // request hung forever. That is the exact shape the extensionless-name bug
  // took. Every throw now rejects the deferred instead, so one bad file fails
  // its own request rather than wedging it; `resolveUploadNames` is the
  // hardening for the specific case, this is the backstop for the class.
  function onFile(name, file) {
    try {
      onFileUnsafe(name, file);
    } catch (error) {
      deferred.reject(error);
    }
  }

  function onFileUnsafe(name, file) {
    // remove empty files
    if (file.size === 0) return;
    // markup will be saved in DB
    if (name === 'markup') return;
    // put all other files in the right place (S3 || local)
    const names = resolveUploadNames(file, options.prefix);
    if (!names) {
      logger.warn('[UPLOAD] unable to name the upload', file.name, file.type);
      return;
    }
    // What the user actually named the file, before the slug flattened its
    // spaces and its case. `originalName` below cannot carry it: it keys the
    // template assets map, and generate-preview.controller rebuilds that key
    // with slugFilename too, so the two must stay spelled the same way. The
    // gallery label reads this one instead — a search for "mon image" has to
    // find a file called "Mon Image.jpg".
    //
    // It doubles as the mark that this upload was accepted: handleEditorUpload
    // refuses to describe a file that does not carry it.
    file.uploadedName = `${file.name}`;
    const dimensions = probeImageDimensions(readHead(file, JPEG_SNIFF_BYTES));
    if (dimensions) {
      file.width = dimensions.width;
      file.height = dimensions.height;
    }
    file.name = names.name;
    file.originalName = names.originalName;
    uploads.push(writeStreamFromPath(file));
  }

  function onEnd(err, fields, files) {
    if (err) return deferred.reject(err);
    logger.log('[UPLOAD] form parsed', uploads.length);
    // wait all TMP files to be moved in the good location (s3 or local)
    Promise.all(uploads)
      .then(() => {
        formatters[options.formatter](
          fields,
          files,
          deferred.resolve,
          deferred.reject
        );
      })
      .catch(deferred.reject);
  }

  return deferred;
}

/// ///
// EXPOSE
/// ///

module.exports = {
  streamImage,
  streamImageFromPreviews,
  list: listImages,
  parseMultipart,
  copyImages,
  writeStreamFromPath,
  writeStreamFromStream,
  writeStreamFromStreamWithPrefix,
};
