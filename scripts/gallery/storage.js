'use strict';

/**
 * Opens a stored gallery file: its bytes, and the date the storage holds for
 * it (S3's Last-Modified, the file's mtime on disk).
 *
 * The application's `streamImage` hands back the bytes only, and the S3
 * response headers carrying the date stay inside it. Reading them from the
 * same request costs nothing; a HEAD per file would double the requests. So
 * the backfill opens files itself, with the same settings as the
 * application (`packages/server/utils/storage-s3.js`, `storage-local.js`).
 */

const fs = require('fs');
const path = require('path');

const config = require('../../packages/server/node.config.js');

const isSuccess = (statusCode) => statusCode >= 200 && statusCode < 300;

// A date the storage does not give, or gives garbled, is no date: never one
// made up in its place.
function parseDate(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date : null;
}

/**
 * @param {object} s3 an AWS.S3 client
 * @param {string} bucket
 * @returns {Function} name => { stream, storedAt: Promise<Date|null> }
 */
function openFromS3(s3, bucket) {
  return (name) => {
    const request = s3.getObject({ Bucket: bucket, Key: name });
    const storedAt = new Promise((resolve) => {
      // fired again on a retry: only the answer that serves the file counts
      request.on('httpHeaders', (statusCode, headers) => {
        if (isSuccess(statusCode)) resolve(parseDate(headers['last-modified']));
      });
      // an error, an abort, or a body done without a 2xx: no date
      request.on('complete', () => resolve(null));
    });
    const stream = request.createReadStream();
    // as the application does: destroying the stream aborts the request
    stream.destroy = request.abort.bind(request);
    return { stream, storedAt };
  };
}

function openFromDisk(directory) {
  return (name) => {
    const filePath = path.join(directory, name);
    return {
      stream: fs.createReadStream(filePath),
      storedAt: fs.promises.stat(filePath).then(
        (stats) => stats.mtime,
        () => null
      ),
    };
  };
}

// The same client as the application's: its settings, its timeouts.
function applicationS3() {
  // only loaded for S3: it reads the whole SDK
  // eslint-disable-next-line global-require
  const AWS = require('aws-sdk');
  const { aws } = config.storage;
  return new AWS.S3({
    ...aws,
    endpoint: new AWS.Endpoint(aws.endpoint),
    maxRetries: 2,
    httpOptions: { connectTimeout: 5000, timeout: 60000 },
  });
}

let open = null;
// Chosen on first use: `config.setup` resolves the upload directory first.
function openStoredFile(name) {
  if (!open) {
    open = config.isAws
      ? openFromS3(applicationS3(), config.storage.aws.bucketName)
      : openFromDisk(config.images.uploadDir);
  }
  return open(name);
}

// The configured endpoint may or may not carry a scheme; keep the host only.
function endpointHost(endpoint) {
  const host = String(endpoint || '')
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^[^@/]*@/, '')
    .split('/')[0];
  return host || 'the default endpoint';
}

// What the operator needs to tell a misconfigured run from a real one.
function describeStorage() {
  if (config.isAws) {
    const { bucketName, endpoint } = config.storage.aws || {};
    return `Storage: S3, bucket "${bucketName}" at ${endpointHost(endpoint)}`;
  }
  return `Storage: local directory ${config.images.uploadDir}`;
}

module.exports = {
  openStoredFile,
  openFromS3,
  openFromDisk,
  describeStorage,
  endpointHost,
};
