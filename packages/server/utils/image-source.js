'use strict';

// Reading the images an email loads, for the exports that carry them: the
// regular and CDN ZIP, the FTP upload, Adobe Campaign, and an image added to
// the gallery from a URL. Those URLs are written by the email's authors (or
// come from a feed): the server must not be made to read a private address
// with them, and hand its answer back in a ZIP or to a host the company
// reads.
//
// Our own gallery's images are read directly: on a developer's machine they
// are on localhost. Any other address must be a public one. The agents check
// the addresses a name resolves to at connection time (guardedLookup); a
// literal IP never reaches them, so it is checked before; redirects are
// followed by hand, each hop checked as the first one.

const net = require('net');
const http = require('http');
const https = require('https');
const fetch = require('node-fetch');
const config = require('../node.config.js');
const { guardedLookup, isBlockedAddress } = require('./outbound-host.js');

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const MAX_REDIRECTS = 3;

const httpAgent = new http.Agent({ lookup: guardedLookup });
const httpsAgent = new https.Agent({ lookup: guardedLookup });

// Our own gallery's images only: the rest of our host gets no exemption.
function isOwnImage(url) {
  try {
    const { host, pathname } = new URL(url);
    return host === config.host && pathname.startsWith('/api/images/');
  } catch (error) {
    return false;
  }
}

function assertPublicLiteral(url) {
  const { protocol, hostname } = new URL(url);
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(`image source protocol refused: ${protocol}`);
  }
  const address = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(address) && isBlockedAddress(address)) {
    throw new Error('image source address refused');
  }
}

/**
 * The bytes of an image, read from a URL of an email.
 * @param {string} url
 * @param {Object} [options]
 * @param {number} [options.timeoutMs] for the whole chain of redirects
 * @param {number} [options.maxBytes] larger, the image is refused
 * @returns {Promise<{ content: Buffer, contentType: string | null }>}
 * @throws {Error} on a refused address, a failed answer, a timeout or an
 *   image too large
 */
async function readImageSource(
  url,
  { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES } = {}
) {
  const deadline = Date.now() + timeoutMs;
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const own = isOwnImage(current);
    if (!own) assertPublicLiteral(current);
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('image source timed out');
    const response = await fetch(current, {
      redirect: 'manual',
      timeout: remaining,
      size: maxBytes,
      agent: own
        ? undefined
        : (parsed) => (parsed.protocol === 'http:' ? httpAgent : httpsAgent),
    });
    const location =
      response.status >= 300 && response.status < 400
        ? response.headers.get('location')
        : null;
    if (location) {
      // Read off, so that the socket is freed for the next hop.
      if (response.body && typeof response.body.resume === 'function') {
        response.body.resume();
      }
      current = new URL(location, current).href;
      continue;
    }
    if (!response.ok) {
      throw new Error(`image source answered ${response.status}`);
    }
    return {
      content: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type'),
    };
  }
  throw new Error('image source redirects too many times');
}

module.exports = { readImageSource };
