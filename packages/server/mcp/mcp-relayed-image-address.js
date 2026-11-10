'use strict';

// The address of a relayed image (ADR 0022): an address of the instance that
// names the image and carries its signature, under a key of its own.

const crypto = require('crypto');
const config = require('../node.config.js');
const { siteOrigin } = require('../utils/site-origin.js');

const ROUTE = '/api/relayed-images';
const KEY_VARIABLE = 'lepatron_relayedImagesKey';
// `<version>:<secret>`: a whole number from 1, then 32 characters at least.
const KEY_FORMAT = /^([1-9]\d{0,5}):(.{32,})$/s;

/**
 * The key that signs the relayed addresses, and its version, which every
 * signature carries. A key of its own: changing it cuts the addresses signed
 * before and signs nobody out. Without one, a key derived from the session
 * secret, version 0, which changes only with it, so that an instance
 * configured before it keeps its addresses.
 *
 * @param {{ relayedImagesKey?: string, sessionSecret: string }} settings
 * @returns {{ version: number, secret: string|Buffer }}
 * @throws {Error} when the key is set but not written `<version>:<secret>`
 */
function signingKeyOf({ relayedImagesKey, sessionSecret }) {
  if (!relayedImagesKey) {
    return {
      version: 0,
      secret: crypto
        .createHmac('sha256', String(sessionSecret))
        .update('mcp-relayed-images')
        .digest(),
    };
  }
  const written = KEY_FORMAT.exec(String(relayedImagesKey));
  if (!written) {
    throw new Error(
      `${KEY_VARIABLE} is written <version>:<secret>, the version a whole ` +
        'number from 1 and the secret 32 characters at least.'
    );
  }
  return { version: Number(written[1]), secret: written[2] };
}

// Read once: the server does not start on a key written wrong.
const KEY = signingKeyOf(config);

// A purpose of its own, and the key's version: no other signature of the
// instance, and no signature under an earlier key, is a valid one.
const signatureOf = (url) =>
  `${KEY.version}.${crypto
    .createHmac('sha256', KEY.secret)
    .update(`mcp-relayed-image:${KEY.version}:${url}`)
    .digest('base64url')}`;

// An address as a query parameter, every character a CSS string or a url()
// could end on encoded: the rewriting runs after the sanitiser, so what it
// writes is inert wherever it lands.
const asParameter = (url) =>
  encodeURIComponent(url).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );

/**
 * The address of the instance that relays this image, signed for it, with
 * no expiry.
 *
 * @param {string} url the image's own address
 * @returns {string}
 */
function relayedUrlOf(url) {
  return `${siteOrigin()}${ROUTE}/${signatureOf(url)}?url=${asParameter(url)}`;
}

/**
 * Whether the instance signed this address, under its current key.
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

module.exports = { relayedUrlOf, isSigned, signingKeyOf, ROUTE };
