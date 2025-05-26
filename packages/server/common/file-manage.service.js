'use strict';

const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const chalk = require('chalk');
const formidable = require('formidable');

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
    const ext = mime.extension(file.type);
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
        // 🧹 NETTOYAGE DES FICHIERS TEMPORAIRES
        Object.values(files)
          .flat()
          .forEach((file) => {
            if (file && file.path && fs.existsSync(file.path)) {
              fs.unlink(file.path, (err) => {
                if (err)
                  console.warn('Failed to remove tmp file:', file.path, err);
                else console.log('Removed tmp file:', file.path);
              });
            }
          });
        // Format final pour resolve
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
  streamImage,
  streamImageFromPreviews,
  list: listImages,
  parseMultipart,
  copyImages,
  writeStreamFromPath,
  writeStreamFromStream,
  writeStreamFromStreamWithPrefix,
};
