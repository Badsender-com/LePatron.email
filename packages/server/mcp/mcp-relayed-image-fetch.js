'use strict';

// The instance fetches a relayed image (ADR 0022) under the guard of the
// outgoing calls, and bounds what the public route may cost it: the images
// it fetched are kept a few minutes, one fetch serves every request for the
// same image, and a process runs a bounded number of fetches at a time.

const { guardedFetch } = require('../integration-providers/provider-http.js');
const { createSizedCache } = require('../utils/sized-cache.js');
const { isInstanceHost } = require('./mcp-relayed-image-address.js');

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;
// Per process: what the cache holds of the images, and for how long.
const CACHE_BUDGET_BYTES = 50 * 1024 * 1024;
const CACHE_TTL_MS = 10 * 60 * 1000;
// Per process: each fetch holds a connection up to 10 s and its image in
// memory up to 5 MB. Past it, a new image is answered as none.
const MAX_FETCHES_IN_FLIGHT = 20;

// The type of an image, read from its first bytes; null for anything else,
// an SVG included.
function imageTypeOf(bytes) {
  const starts = (...signature) =>
    signature.every((byte, i) => bytes[i] === byte);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (starts(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (
    starts(0x52, 0x49, 0x46, 0x46) &&
    bytes.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/**
 * The image at this address, fetched under the guard of the outgoing calls:
 * https at every hop, no private or internal address nor the instance's own
 * host, a few redirects, a time and size budget. Null when it is refused,
 * unreachable or no image.
 *
 * @param {string} url
 * @returns {Promise<{ type: string, bytes: Buffer }|null>}
 */
async function fetchRelayedImage(url) {
  if (!/^https:\/\//i.test(url) || isInstanceHost(url) !== false) return null;
  try {
    const response = await guardedFetch(url, {
      httpsOnly: true,
      allowsHop: (hop) => isInstanceHost(hop) === false,
      maxRedirects: MAX_REDIRECTS,
      timeoutMs: TIMEOUT_MS,
      maxBytes: MAX_BYTES,
      label: 'relayed image',
    });
    if (!response.ok) return null;
    const bytes = await response.buffer();
    const type = imageTypeOf(bytes);
    return type ? { type, bytes } : null;
  } catch (err) {
    return null;
  }
}

const images = createSizedCache({
  budget: CACHE_BUDGET_BYTES,
  maxEntry: MAX_BYTES,
  ttlMs: CACHE_TTL_MS,
  sizeOf: (image) => image.bytes.length,
});
const fetching = new Map();

/**
 * The image at this address, from the cache, from the fetch of it already
 * running, or fetched. Null when it is no image, or when the process already
 * runs as many fetches as it may.
 *
 * @param {string} url
 * @returns {Promise<{ type: string, bytes: Buffer }|null>}
 */
function relayedImage(url) {
  const cached = images.get(url);
  if (cached) return Promise.resolve(cached);
  if (fetching.has(url)) return fetching.get(url);
  if (fetching.size >= MAX_FETCHES_IN_FLIGHT) return Promise.resolve(null);
  const fetched = fetchRelayedImage(url)
    .then((image) => {
      if (image) images.set(url, image);
      return image;
    })
    .finally(() => fetching.delete(url));
  fetching.set(url, fetched);
  return fetched;
}

module.exports = {
  relayedImage,
  fetchRelayedImage,
  imageTypeOf,
  MAX_FETCHES_IN_FLIGHT,
};
