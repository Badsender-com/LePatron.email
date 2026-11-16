'use strict';

const fs = require('fs-extra');
const path = require('path');
const { Readable } = require('node:stream');

const config = require('../node.config.js');
const defer = require('../helpers/create-promise.js');
const formatName = require('../helpers/format-filename-for-jquery-fileupload.js');
const logger = require('../utils/logger.js');

// A stored name is a file name of the upload folder: no separator, no parent
// reference, no NUL. The name comes from the URL, where Express has already
// decoded `%2F`.
const NOT_A_FILE_NAME = /[/\\\0]|\.\./;

// The path of `name` in the upload folder, or null when it is not one of its
// files.
function uploadPathOf(name) {
  if (typeof name !== 'string' || name === '' || NOT_A_FILE_NAME.test(name)) {
    return null;
  }
  const folder = path.resolve(config.images.uploadDir);
  const filePath = path.resolve(folder, name);
  return filePath.startsWith(folder + path.sep) ? filePath : null;
}

// A read that fails as a missing file does, so the caller answers 404.
function missingFileStream(name) {
  const readable = new Readable({ read() {} });
  const error = Object.assign(new Error(`ENOENT: no such file, '${name}'`), {
    code: 'ENOENT',
  });
  process.nextTick(() => readable.destroy(error));
  return readable;
}

// https://docs.nodejitsu.com/articles/advanced/streams/how-to-use-fs-create-read-stream/
function streamImage(imageName) {
  const imagePath = uploadPathOf(imageName);
  if (!imagePath) return missingFileStream(imageName);
  return fs.createReadStream(imagePath);
}

function writeStreamFromPath(file) {
  const deferred = defer();
  // every files are uploaded to the uploadDir
  const destPath = path.join(config.images.uploadDir, file.name);
  const source = fs.createReadStream(file.path);
  const dest = fs.createWriteStream(destPath);
  source.pipe(dest).on('error', deferred.reject).on('close', deferred.resolve);
  return deferred;
}

function writeStreamFromStream(source, name) {
  const deferred = defer();
  const destPath = path.join(config.images.uploadDir, name);
  const dest = fs.createWriteStream(destPath);
  source.pipe(dest).on('error', deferred.reject).on('close', deferred.resolve);
  return deferred;
}

function listImages(prefix) {
  const prefixRegexp = new RegExp(`^${prefix}`);

  return fs.readdir(config.images.uploadDir).then((files) => {
    files = files.filter((file) => prefixRegexp.test(file)).map(formatName);
    return Promise.resolve(files);
  });
}

function copyImages(oldPrefix, newPrefix) {
  logger.info('copying images with local storage');
  return listImages(oldPrefix).then((files) => {
    files = files.map(copy);
    return Promise.all(files);
  });

  function copy(file) {
    const srcPath = path.join(config.images.uploadDir, file.name);
    const dstPath = srcPath.replace(oldPrefix, newPrefix);
    return fs.copy(srcPath, dstPath);
  }
}

module.exports = {
  streamImage,
  writeStreamFromPath,
  writeStreamFromStream,
  listImages,
  copyImages,
};
