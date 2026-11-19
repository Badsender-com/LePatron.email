'use strict';

// The external images of a mailing's preview, relayed by the instance (ADR
// 0022): the app's CSP keeps images to the instance, so the preview an app is
// handed shows an image hosted elsewhere through an address of the instance,
// signed for that image (mcp-relayed-image-address.js), which fetches it
// (mcp-relayed-image-fetch.js).

const {
  relayedUrlOf,
  isInstanceOrigin,
} = require('./mcp-relayed-image-address.js');
const { createSizedCache } = require('../utils/sized-cache.js');

// Characters, as the cache of the sanitised previews counts them.
const RELAYED_PREVIEWS_BUDGET = 8 * 1024 * 1024;

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
  return /^https:\/\//i.test(url) && isInstanceOrigin(url) === false;
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
  relayPreviewImages,
  relayPreviewImagesCached,
};
