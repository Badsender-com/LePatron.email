/* eslint-disabled */

const fs = require('fs-extra');
const AWS = require('aws-sdk');
const denodeify = require('denodeify');
const logger = require('../utils/logger.js');

const config = require('../node.config.js');
const defer = require('../helpers/create-promise.js');
const formatName = require('../helpers/format-filename-for-jquery-fileupload.js');

if (!config.isAws) {
  module.exports = {};
} else {
  AWS.config.update(config.storage.aws);
  const s3 = new AWS.S3();

  // http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-examples.html#Amazon_Simple_Storage_Service__Amazon_S3_
  // http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getObject-property
  const streamImage = (imageName) => {
    const awsRequest = s3.getObject({
      Bucket: config.storage.aws.bucketName,
      Key: imageName,
    });
    const awsStream = awsRequest.createReadStream();
    // break if no bind…
    // mirror fs stream method name
    awsStream.destroy = awsRequest.abort.bind(awsRequest);
    return awsStream;
  };

  // http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#upload-property
  const writeStreamFromPath = (file) => {
    const deferred = defer();
    const { name, path } = file;
    const source = fs.createReadStream(path);

    s3.upload(
      {
        Bucket: config.storage.aws.bucketName,
        Key: name,
        Body: source,
      },
      function (err, data) {
        console.log(err, data);
      }
    )
      .on('httpUploadProgress', (progress) => {
        console.log(
          `writeStreamFromPath – ${name}`,
          (progress.loaded / progress.total) * 100
        );
        if (progress.loaded >= progress.total) deferred.resolve();
      })
      .on('error', deferred.reject);

    return deferred;
  };

  const writeStreamFromStream = (source, name) => {
    const deferred = defer();

    s3.upload(
      {
        Bucket: config.storage.aws.bucketName,
        Key: name,
        Body: source,
      },
      (err, data) => {
        console.log(err, data);
        // if (err) return reject( err )
        // resolve( data )
      }
    )
      .on('httpUploadProgress', (progress) => {
        console.log(
          `writeStreamFromStream – ${name}`,
          (progress.loaded / progress.total) * 100
        );
        if (progress.loaded >= progress.total) deferred.resolve();
      })
      .on('error', deferred.reject);

    return deferred;
  };

  // http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listObjectsV2-property
  // https://github.com/matthew-andrews/denodeify#advanced-usage
  const listObjectsV2 = denodeify(s3.listObjectsV2.bind(s3), (err, data) => {
    if (data && data.Contents) {
      data = data.Contents.map((file) => formatName(file.Key));
    }
    return [err, data];
  });

  const listImages = (prefix) => {
    return listObjectsV2({
      Bucket: config.storage.aws.bucketName,
      Prefix: prefix,
    });
  };

  // http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#copyObject-property
  const copyObject = denodeify(s3.copyObject.bind(s3));
  const copyImages = (oldPrefix, newPrefix) => {
    logger.info('copying images with S3 storage');
    return listImages(oldPrefix).then((files) => Promise.all(files.map(copy)));

    function copy(file) {
      return copyObject({
        Bucket: config.storage.aws.bucketName,
        CopySource: config.storage.aws.bucketName + '/' + file.name,
        Key: file.name.replace(oldPrefix, newPrefix.toString()),
      });
    }
  };

  module.exports = {
    streamImage,
    writeStreamFromPath,
    writeStreamFromStream,
    listImages,
    copyImages,
  };
}
