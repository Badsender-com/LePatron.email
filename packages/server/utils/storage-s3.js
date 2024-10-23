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
  // AWS.config.update(config.storage.aws);
  const endpoint = new AWS.Endpoint(config.storage.aws.endpoint);
  const s3 = new AWS.S3({
    endpoint,
    accessKeyId: config.storage.aws.accessKeyId,
    secretAccessKey: config.storage.aws.secretAccessKey,
    region: config.storage.aws.region,
  });
  const newEndpoint = new AWS.Endpoint(config.storage.newAws.endpoint);
  const newS3 = new AWS.S3({
    endpoint: newEndpoint,
    accessKeyId: config.storage.newAws.accessKeyId,
    secretAccessKey: config.storage.newAws.secretAccessKey,
    region: config.storage.newAws.region,
  });

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
    const source2 = fs.createReadStream(path);

    const upload1 = s3
      .upload(
        {
          Bucket: config.storage.aws.bucketName,
          Key: name,
          Body: source,
        },
        function (err, data) {
          logger.error(err, data);
        }
      )
      .on('httpUploadProgress', (progress) => {
        logger.info(
          `writeStreamFromPath 1 – ${name}`,
          (progress.loaded / progress.total) * 100
        );
      })
      .on('error', deferred.reject)
      .promise();

    const upload2 = newS3
      .upload(
        {
          Bucket: config.storage.newAws.bucketName,
          Key: name,
          Body: source2,
        },
        function (err, data) {
          logger.error(err, data);
        }
      )
      .on('httpUploadProgress', (progress) => {
        logger.info({ progress });
        logger.info(
          `writeStreamFromPath 2 – ${name}`,
          (progress.loaded / progress.total) * 100
        );
      })
      .on('error', deferred.reject)
      .promise();

    Promise.all([upload1, upload2]).then(() => {
      deferred.resolve();
    });

    return deferred;
  };

  const writeStreamFromStream = (source, name) => {
    const deferred = defer();

    const upload1 = s3
      .upload(
        {
          Bucket: config.storage.aws.bucketName,
          Key: name,
          Body: source,
        },
        (err, data) => {
          logger.error(err, data);
          // if (err) return reject( err )
          // resolve( data )
        }
      )
      .on('httpUploadProgress', (progress) => {
        logger.info(
          `writeStreamFromStream 1 – ${name}`,
          (progress.loaded / progress.total) * 100
        );
      })
      .on('error', deferred.reject)
      .promise();

    const upload2 = newS3
      .upload(
        {
          Bucket: config.storage.newAws.bucketName,
          Key: name,
          Body: source,
        },
        (err, data) => {
          logger.error(err, data);
          // if (err) return reject( err )
          // resolve( data )
        }
      )
      .on('httpUploadProgress', (progress) => {
        logger.info(
          `writeStreamFromStream 2 – ${name}`,
          (progress.loaded / progress.total) * 100
        );
      })
      .on('error', deferred.reject)
      .promise();

    Promise.all([upload1, upload2]).then(() => {
      deferred.resolve();
    });

    return deferred;
  };

  const writeStreamFromStreamWithPrefix = (source, name, prefix) => {
    const deferred = defer();

    const upload1 = s3
      .upload(
        {
          Bucket: config.storage.aws.bucketName,
          Prefix: prefix,
          Key: name,
          Body: source,
        },
        (err, data) => {
          logger.error(err, data);
        }
      )
      .on('httpUploadProgress', (progress) => {
        logger.info(
          `writeStreamFromStreamWithPrefix 1 – ${name}`,
          (progress.loaded / progress.total) * 100
        );
      })
      .on('error', deferred.reject)
      .promise();

    const upload2 = newS3
      .upload(
        {
          Bucket: config.storage.newAws.bucketName,
          Prefix: prefix,
          Key: name,
          Body: source,
        },
        (err, data) => {
          logger.error(err, data);
        }
      )
      .on('httpUploadProgress', (progress) => {
        logger.info(
          `writeStreamFromStreamWithPrefix 2 – ${name}`,
          (progress.loaded / progress.total) * 100
        );
      })
      .on('error', deferred.reject)
      .promise();

    Promise.all([upload1, upload2]).then(() => {
      deferred.resolve();
    });

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
  const newCopyObject = denodeify(newS3.copyObject.bind(newS3));
  const copyImages = (oldPrefix, newPrefix) => {
    logger.info('copying images with S3 storage');
    return listImages(oldPrefix).then((files) => Promise.all(files.map(copy)));

    async function copy(file) {
      await newCopyObject({
        Bucket: config.storage.newAws.bucketName,
        CopySource: config.storage.newAws.bucketName + '/' + file.name,
        Key: file.name.replace(oldPrefix, newPrefix),
      });
      return copyObject({
        Bucket: config.storage.aws.bucketName,
        CopySource: config.storage.aws.bucketName + '/' + file.name,
        Key: file.name.replace(oldPrefix, newPrefix),
      });
    }
  };

  module.exports = {
    streamImage,
    writeStreamFromPath,
    writeStreamFromStream,
    writeStreamFromStreamWithPrefix,
    listImages,
    copyImages,
  };
}
