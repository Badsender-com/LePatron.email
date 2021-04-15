'use strict';

const fs = require('fs-extra');
const path = require('path');

const config = require('../node.config.js');
const defer = require('../helpers/create-promise.js');
const formatName = require('../helpers/format-filename-for-jquery-fileupload.js');
const logger = require('../utils/logger.js');

// https://docs.nodejitsu.com/articles/advanced/streams/how-to-use-fs-create-read-stream/
function streamImage(imageName) {
  const imagePath = path.join(config.images.uploadDir, imageName);
  return fs.createReadStream(imagePath);
}

function streamImageFromPreviews(imageName, prefix) {
  const directory = `${config.images.previewsDir}/${prefix}`;

  const imagePath = path.join(directory, imageName);
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

function writeStreamFromStreamWithPrefix(source, name, prefix) {
  const deferred = defer();

  const directory = `${config.images.previewsDir}/${prefix}`;

  if(!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const destPath = path.join(directory, name);

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
  streamImageFromPreviews,
  writeStreamFromPath,
  writeStreamFromStream,
  writeStreamFromStreamWithPrefix,
  listImages,
  copyImages,
};
