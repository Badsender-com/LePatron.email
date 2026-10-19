'use strict';

/**
 * Reads the dimensions of a stored gallery file, from the head of the file
 * only, and says why when it cannot: a file missing from the storage is not
 * the same news as a storage that timed out, and the operator acts on each
 * differently (look into it, or rerun).
 */

const path = require('path');
const probe = require('probe-image-size');

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

// The size of a JPEG sits in its frame header, after every metadata segment
// (EXIF, XMP, ICC profile, Photoshop). The shared reader stops at 128KB, which
// is right for an upload; a stored JPEG whose metadata runs past it is read on,
// up to this bound. Only a JPEG: its parser walks the segments by their
// lengths, and a JPEG cannot reach the SVG parser, quadratic in what it reads.
const JPEG_MAX_BYTES = 4 * 1024 * 1024;

const isJpeg = (head) =>
  head.length > 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;

const READ_STATUS = Object.freeze({
  OK: 'ok',
  INVALID_NAME: 'invalid-name',
  MISSING: 'missing',
  NOT_AN_IMAGE: 'not-an-image',
  // a JPEG whose size could not be found: still an image, maybe in use
  UNMEASURED: 'unmeasured',
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
function readDimensions(name, options = {}) {
  if (!isSafeName(name)) {
    return Promise.resolve({ status: READ_STATUS.INVALID_NAME });
  }
  const {
    streamImage = fileManager.streamImage,
    timeoutMs = READ_TIMEOUT_MS,
    maxBytes = JPEG_SNIFF_BYTES,
    maxJpegBytes = JPEG_MAX_BYTES,
  } = options;
  return new Promise((resolve) => {
    streamHead(
      name,
      { streamImage, timeoutMs, maxBytes, maxJpegBytes },
      resolve
    );
  });
}

function measureLongJpeg(head) {
  if (head.length <= JPEG_SNIFF_BYTES || !isJpeg(head)) return null;
  try {
    const probed = probe.sync(head);
    return probed && probed.width && probed.height ? probed : null;
  } catch (e) {
    return null;
  }
}

/**
 * What the head read so far says about the file.
 * @returns {object|null} a read result, or null to read on
 */
function measure(head, { complete, maxJpegBytes }) {
  // the shared reader caps what it hands the prober and rounds the result
  const size = probeImageDimensions(head) || measureLongJpeg(head);
  if (size) {
    return { status: READ_STATUS.OK, width: size.width, height: size.height };
  }
  if (!isJpeg(head)) return { status: READ_STATUS.NOT_AN_IMAGE };
  if (!complete && head.length < maxJpegBytes) return null;
  return { status: READ_STATUS.UNMEASURED };
}

// Reads the head of a stored file and hands `settle` one result, exactly once:
// the measure, or why there is none.
function streamHead(name, options, settle) {
  const { streamImage, timeoutMs, maxJpegBytes } = options;
  const chunks = [];
  let total = 0;
  let limit = options.maxBytes;
  let settled = false;
  let stream = null;
  const done = (result) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    settle(result);
  };
  const verdict = (complete) =>
    measure(Buffer.concat(chunks), { complete, maxJpegBytes });
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
    if (total < limit) return;
    const result = verdict(false);
    if (!result) {
      limit = maxJpegBytes;
      return;
    }
    // Settle BEFORE destroying: on S3 `destroy` aborts the request, which
    // emits `error`, and that would otherwise win the race.
    done(result);
    stream.destroy();
  });
  stream.on('end', () => done(verdict(true)));
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
  JPEG_MAX_BYTES,
};
