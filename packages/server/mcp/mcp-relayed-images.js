'use strict';

// The external images of a mailing's preview, relayed by the instance (ADR
// 0022): the app's CSP keeps images to the instance, so an image hosted
// elsewhere is shown through an address of the instance, signed for that
// image, which fetches it under the guard of the outgoing calls.

const crypto = require('crypto');
const config = require('../node.config.js');
const { siteOrigin } = require('../utils/site-origin.js');
const { guardedFetch } = require('../integration-providers/provider-http.js');

const ROUTE = '/api/relayed-images';
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;

// A purpose of its own: no other signature of the instance is a valid one.
const signatureOf = (url) =>
  crypto
    .createHmac('sha256', config.sessionSecret)
    .update(`mcp-relayed-image:${url}`)
    .digest('base64url');

/**
 * The address of the instance that relays this image, signed for it, with
 * no expiry.
 *
 * @param {string} url the image's own address
 * @returns {string}
 */
function relayedUrlOf(url) {
  return `${siteOrigin()}${ROUTE}/${signatureOf(url)}?url=${encodeURIComponent(
    url
  )}`;
}

/**
 * Whether the instance signed this address.
 *
 * @param {string} url
 * @param {string} signature
 * @returns {boolean}
 */
function isSigned(url, signature) {
  const expected = Buffer.from(signatureOf(String(url)));
  const given = Buffer.from(String(signature || ''));
  return (
    expected.length === given.length && crypto.timingSafeEqual(expected, given)
  );
}

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
 * https at every hop, no private or internal address, a few redirects, a
 * time and size budget. Null when it is refused, unreachable or no image.
 *
 * @param {string} url
 * @returns {Promise<{ type: string, bytes: Buffer }|null>}
 */
async function fetchRelayedImage(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  try {
    const response = await guardedFetch(url, {
      httpsOnly: true,
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

// An address as an attribute holds it: the entities a sanitised document
// writes in an attribute, read back.
const decoded = (value) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

// Whether an image is hosted outside the instance, over the web.
function isExternal(url) {
  if (!/^https?:\/\//i.test(url)) return false;
  const origin = siteOrigin();
  return url !== origin && !url.startsWith(`${origin}/`);
}

const relayed = (raw) => {
  const url = decoded(raw.trim());
  return isExternal(url) ? relayedUrlOf(url) : raw;
};

/**
 * The preview an app is handed, every image hosted outside the instance
 * rewritten to its relayed address: in an <img>, a background attribute, or a
 * url() of a style. The images of the instance stay as they are.
 *
 * @param {string} html the sanitised preview
 * @returns {string}
 */
function relayPreviewImages(html) {
  return String(html)
    .replace(
      /(<img\b[^>]*?\ssrc\s*=\s*)(["'])(.*?)\2/gi,
      (_m, before, quote, url) => `${before}${quote}${relayed(url)}${quote}`
    )
    .replace(
      /(\sbackground\s*=\s*)(["'])(.*?)\2/gi,
      (_m, before, quote, url) => `${before}${quote}${relayed(url)}${quote}`
    )
    .replace(
      /url\(\s*(&quot;|["']?)(.*?)\1\s*\)/gi,
      (_m, quote, url) => `url(${quote}${relayed(url)}${quote})`
    );
}

module.exports = {
  relayedUrlOf,
  relayPreviewImages,
  isSigned,
  fetchRelayedImage,
  imageTypeOf,
  ROUTE,
};
