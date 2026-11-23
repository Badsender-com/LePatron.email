'use strict';

// What the client's blocks put in the export: their links and images, read once
// per run from the parsed HTML. The template's frame, outside every block, is
// never part of it.

// A URL carrying an ESP merge tag is only known once the ESP sends the email,
// so it is never judged on its form (merge-tag-syntax.js).
const {
  isDynamic,
} = require('../../../../../shared/quality/merge-tag-syntax.js');
const { HIDING, isHidden, visibleTextOf } = require('../visible-text');

const textOf = (node) => (node.textContent || '').replace(/\s+/g, ' ').trim();

// The start of a text, for a message that names it.
const excerpt = (text) => (text.length > 40 ? `${text.slice(0, 40)}…` : text);

// A URL parsed without throwing, or null.
function parseUrl(value) {
  try {
    return new URL(value);
  } catch (e) {
    return null;
  }
}

// Whether only the host is the ESP's to fill in: `https://{{domain}}/x` is,
// `https://brand.com/?u={{email}}` is not, and the latter's host can still be
// judged. An address the URL parser rejects is dynamic as a whole or not at all.
const hasDynamicHost = (url, dynamic) => (url ? isDynamic(url.host) : dynamic);

/**
 * Links of the client's blocks.
 * @returns {Array<{ anchor: Element, blockId: string, href: string,
 *   text: string, url: URL|null, dynamic: boolean, dynamicHost: boolean }>}
 */
function blockLinks(ctx) {
  if (!ctx.cache.blockLinks) {
    ctx.cache.blockLinks = Array.from(ctx.doc.querySelectorAll('a[href]'))
      .map((anchor) => {
        const href = anchor.getAttribute('href').trim();
        const url = parseUrl(href);
        const dynamic = isDynamic(href);
        return {
          anchor,
          blockId: ctx.blockIdOf(anchor),
          href,
          text: textOf(anchor),
          url,
          dynamic,
          dynamicHost: hasDynamicHost(url, dynamic),
        };
      })
      .filter((link) => link.blockId);
  }
  return ctx.cache.blockLinks;
}

/**
 * Images of the client's blocks.
 * @returns {Array<{ img: Element, blockId: string, src: string|null,
 *   alt: string|null, url: URL|null, dynamic: boolean, dynamicHost: boolean }>}
 */
function blockImages(ctx) {
  if (!ctx.cache.blockImages) {
    ctx.cache.blockImages = Array.from(ctx.doc.querySelectorAll('img'))
      .map((img) => {
        const src = img.getAttribute('src');
        const url = src ? parseUrl(src) : null;
        const dynamic = isDynamic(src);
        return {
          img,
          blockId: ctx.blockIdOf(img),
          src,
          alt: img.getAttribute('alt'),
          url,
          dynamic,
          dynamicHost: hasDynamicHost(url, dynamic),
        };
      })
      .filter((image) => image.blockId);
  }
  return ctx.cache.blockImages;
}

/**
 * Whether an image is served by LePatron's own image backend
 * (`metadata.imagesUrl`: images, cover, crop, placeholder). Such an address is
 * not where the image ends up: the export rehosts it (ZIP, CDN, FTP), so its
 * scheme and host say nothing about the email that is sent.
 */
function isPlatformImage(ctx, src) {
  const imagesUrl = ctx.config.imagesUrl || {};
  return Object.values(imagesUrl).some(
    (prefix) =>
      typeof prefix === 'string' && prefix && (src || '').startsWith(prefix)
  );
}

// Whether an element is shown: neither it nor an ancestor up to `root` hides.
function isShown(el, root) {
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    if (isHidden(node)) return false;
    if (node === root) break;
  }
  return true;
}

/**
 * The visible text of each of the client's blocks, by block id.
 * @returns {Object<string, string>}
 */
function blockTexts(ctx) {
  if (!ctx.cache.blockTexts) {
    ctx.cache.blockTexts = {};
    ctx.blocks.forEach((block) => {
      const root = block && ctx.doc.getElementById(block.id);
      if (root) ctx.cache.blockTexts[block.id] = visibleTextOf(root);
    });
  }
  return ctx.cache.blockTexts;
}

module.exports = {
  HIDING,
  blockLinks,
  blockImages,
  blockTexts,
  excerpt,
  isDynamic,
  isHidden,
  isPlatformImage,
  isShown,
  parseUrl,
  textOf,
  visibleTextOf,
};
