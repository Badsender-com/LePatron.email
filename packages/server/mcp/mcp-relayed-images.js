'use strict';

// The external images of a mailing's preview, relayed by the instance (ADR
// 0022): the app's CSP keeps images to the instance, so an image hosted
// elsewhere is shown through an address of the instance, signed for that
// image, which fetches it under the guard of the outgoing calls.

const crypto = require('crypto');
const config = require('../node.config.js');
const { siteOrigin } = require('../utils/site-origin.js');
const { guardedFetch } = require('../integration-providers/provider-http.js');
const { createSizedCache } = require('../utils/sized-cache.js');

const ROUTE = '/api/relayed-images';
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;
// Characters, as the cache of the sanitised previews counts them.
const RELAYED_PREVIEWS_BUDGET = 8 * 1024 * 1024;

// A purpose of its own: no other signature of the instance is a valid one.
const signatureOf = (url) =>
  crypto
    .createHmac('sha256', config.sessionSecret)
    .update(`mcp-relayed-image:${url}`)
    .digest('base64url');

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

const parsedUrl = (url) => {
  try {
    return new URL(url);
  } catch (err) {
    return null;
  }
};

// Whether an address names the instance's own host, whatever its port: the
// instance never fetches from itself, at any hop.
function isInstanceHost(url) {
  const parsed = parsedUrl(url);
  return Boolean(parsed) && parsed.hostname === new URL(siteOrigin()).hostname;
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
  const parsed = parsedUrl(url);
  if (!parsed || parsed.protocol !== 'https:' || isInstanceHost(url)) {
    return null;
  }
  try {
    const response = await guardedFetch(url, {
      httpsOnly: true,
      allowsHop: (hop) => !isInstanceHost(hop),
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
// writes in an attribute, read back in one pass. A <style> element holds its
// text as it is, and is never decoded.
const ENTITIES = { amp: '&', quot: '"', '#39': "'", lt: '<', gt: '>' };
const decodedAttribute = (value) =>
  value.replace(/&(amp|quot|#39|lt|gt);/g, (_entity, name) => ENTITIES[name]);
const asIs = (value) => value;

// Whether an image is hosted outside the instance, over https: its origin
// compared, so that neither the case nor a default port tells them apart.
function isExternal(url) {
  if (!/^https:\/\//i.test(url)) return false;
  const parsed = parsedUrl(url);
  return Boolean(parsed) && parsed.origin !== new URL(siteOrigin()).origin;
}

// The rewriting runs on every preview handed to an app, synchronously: every
// pattern reads each character a bounded number of times, whatever the
// mailing's author wrote.
const MAX_URL_LENGTH = 2048;
// A tag, its attributes read up to the next `<` or `>`: a scan never runs
// past the next tag.
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]{0,31})([^<>]*)>/g;
const STYLE_END = /<\/style\s*>/gi;
// An attribute as the sanitiser writes it, its value in double quotes.
const ATTRIBUTE = /(\s)([^\s"'<>/=]{1,64})(\s*=\s*)"([^"]*)"/g;
// A url() of a style, its address in bounded characters that hold no quote,
// parenthesis, space nor angle bracket.
const CSS_URL = /url\(\s*(&quot;|["']?)([^"'()<>\s]{1,2048})\1\s*\)/gi;

// The relayed address of an image, or null to leave it as it is. An address
// without a scheme (`//cdn…`) is read as https, as the email reads it in an
// https page; an http one is left as it is, and shows as its alternative text.
const relayed = (raw) => {
  const written = raw.trim();
  const url = written.startsWith('//') ? `https:${written}` : written;
  return url.length <= MAX_URL_LENGTH && isExternal(url)
    ? relayedUrlOf(url)
    : null;
};

const relayStyle = (css, decoded) =>
  css.replace(CSS_URL, (whole, quote, url) => {
    const relayedUrl = relayed(decoded(url));
    return relayedUrl ? `url(${quote}${relayedUrl}${quote})` : whole;
  });

// An opening tag, its image attributes relayed: the source of an <img>, the
// background attribute of any tag, the url() of a style attribute.
function relayTag(name, attributes) {
  const isImg = name.toLowerCase() === 'img';
  const rewritten = attributes.replace(
    ATTRIBUTE,
    (whole, space, attribute, equals, value) => {
      const lower = attribute.toLowerCase();
      if (lower === 'style') {
        return `${space}${attribute}${equals}"${relayStyle(
          value,
          decodedAttribute
        )}"`;
      }
      if (lower !== 'background' && !(isImg && lower === 'src')) return whole;
      const relayedUrl = relayed(decodedAttribute(value));
      return relayedUrl
        ? `${space}${attribute}${equals}"${relayedUrl}"`
        : whole;
    }
  );
  return `<${name}${rewritten}>`;
}

/**
 * The preview an app is handed, every image hosted outside the instance
 * rewritten to its relayed address: in an <img>, a background attribute, or a
 * url() of a style, a <style> element or a style attribute. The images of the
 * instance stay as they are, and so does the text of the email.
 *
 * @param {string} html the sanitised preview
 * @returns {string}
 */
function relayPreviewImages(html) {
  const source = String(html);
  const tags = new RegExp(TAG.source, 'g');
  let relayedHtml = '';
  let copied = 0;
  let tag = tags.exec(source);
  while (tag) {
    const [whole, closing, name, attributes] = tag;
    relayedHtml += source.slice(copied, tag.index);
    relayedHtml += closing ? whole : relayTag(name, attributes);
    copied = tags.lastIndex;
    if (!closing && name.toLowerCase() === 'style') {
      // A style sheet is read up to its end tag, never as tags.
      const styleEnd = new RegExp(STYLE_END.source, 'gi');
      styleEnd.lastIndex = copied;
      const end = styleEnd.exec(source);
      const stop = end ? end.index : source.length;
      relayedHtml += relayStyle(source.slice(copied, stop), asIs);
      copied = stop;
      tags.lastIndex = stop;
    }
    tag = tags.exec(source);
  }
  return relayedHtml + source.slice(copied);
}

// The rewritten previews, kept like the sanitised ones they come from, under
// the same key (the mailing and its last write). The signing key and the
// instance's origin are fixed for a process, so they need no part in it.
const relayedPreviews = createSizedCache({
  budget: RELAYED_PREVIEWS_BUDGET,
  maxEntry: RELAYED_PREVIEWS_BUDGET / 10,
  sizeOf: (html) => html.length,
});

/**
 * The preview an app is handed, as `relayPreviewImages` writes it, rewritten
 * once for each saved preview of a mailing.
 *
 * @param {string|undefined} key what tells a saved preview from another
 *   (`previewCacheKeyOf`); without one, the preview is rewritten every time
 * @param {string} html the sanitised preview
 * @returns {string}
 */
function relayPreviewImagesCached(key, html) {
  if (!key) return relayPreviewImages(html);
  const cached = relayedPreviews.get(key);
  if (cached !== undefined) return cached;
  const relayedHtml = relayPreviewImages(html);
  relayedPreviews.set(key, relayedHtml);
  return relayedHtml;
}

module.exports = {
  relayedUrlOf,
  relayPreviewImages,
  relayPreviewImagesCached,
  isSigned,
  fetchRelayedImage,
  imageTypeOf,
  ROUTE,
};
