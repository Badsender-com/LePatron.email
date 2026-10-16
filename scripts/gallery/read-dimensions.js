'use strict';

/**
 * Reads the dimensions of a stored gallery file, from the head of the file
 * only, and says why when it cannot: a file missing from the storage is not
 * the same news as a storage that timed out, and the operator acts on each
 * differently (clean up, or rerun).
 */

const path = require('path');

const config = require('../../packages/server/node.config.js');
const fileManager = require('../../packages/server/common/file-manage.service.js');
const {
  probeImageDimensions,
  JPEG_SNIFF_BYTES,
} = require('../../packages/server/common/upload-identity.service.js');

// A stalled read would otherwise hang the run with no output. Above the S3
// client's own budget (5s to connect, retried twice), so a cold connection is
// not mistaken for a stalled one.
const READ_TIMEOUT_MS = 20000;

const READ_STATUS = Object.freeze({
  OK: 'ok',
  INVALID_NAME: 'invalid-name',
  MISSING: 'missing',
  NOT_AN_IMAGE: 'not-an-image',
  TIMEOUT: 'timeout',
  ERROR: 'error',
});

// ENOENT: local disk. NoSuchKey / NotFound and a 404: S3.
const MISSING_CODES = new Set(['ENOENT', 'NoSuchKey', 'NotFound']);

// Names are server-generated, but this walks every record in the collection,
// including whatever a DAM import or a hand-made write put there, and the
// local backend joins the name to the upload directory.
function isSafeName(name) {
  return (
    typeof name === 'string' &&
    name !== '' &&
    name !== '.' &&
    name !== '..' &&
    !name.includes('\0') &&
    path.basename(name) === name
  );
}

function classifyError(error) {
  if (error && (MISSING_CODES.has(error.code) || error.statusCode === 404)) {
    return { status: READ_STATUS.MISSING };
  }
  // the code, not the message: enough to diagnose, nothing to leak
  return {
    status: READ_STATUS.ERROR,
    code: (error && (error.code || error.name)) || 'unknown',
  };
}

/**
 * @param {string} name a gallery file name
 * @param {object} [options] injectable for tests
 * @returns {Promise<{status: string, width?: number, height?: number, code?: string}>}
 *   never rejects
 */
function readDimensions(
  name,
  {
    streamImage = fileManager.streamImage,
    timeoutMs = READ_TIMEOUT_MS,
    maxBytes = JPEG_SNIFF_BYTES,
  } = {}
) {
  if (!isSafeName(name)) {
    return Promise.resolve({ status: READ_STATUS.INVALID_NAME });
  }
  return new Promise((resolve) => {
    const chunks = [];
    let total = 0;
    let settled = false;
    let stream = null;
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const finish = () => {
      // the shared reader caps what it hands the prober and rounds the result
      const size = probeImageDimensions(Buffer.concat(chunks));
      done(
        size
          ? { status: READ_STATUS.OK, width: size.width, height: size.height }
          : { status: READ_STATUS.NOT_AN_IMAGE }
      );
    };
    const timer = setTimeout(() => {
      done({ status: READ_STATUS.TIMEOUT });
      if (stream) stream.destroy();
    }, timeoutMs);

    try {
      stream = streamImage(name);
    } catch (error) {
      done(classifyError(error));
      return;
    }
    stream.on('error', (error) => done(classifyError(error)));
    stream.on('data', (chunk) => {
      if (settled) return;
      chunks.push(chunk);
      total += chunk.length;
      if (total >= maxBytes) {
        // Settle BEFORE destroying: on S3 `destroy` aborts the request, which
        // emits `error`, and that would otherwise win the race.
        finish();
        stream.destroy();
      }
    });
    stream.on('end', finish);
  });
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
  readDimensions,
  describeStorage,
  endpointHost,
  isSafeName,
  classifyError,
  READ_STATUS,
  READ_TIMEOUT_MS,
};
