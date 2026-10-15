'use strict';

// What the client's blocks put in the export: their links and images, read once
// per run from the parsed HTML. The template's frame, outside every block, is
// never part of it.

// A URL carrying an ESP merge tag is only known once the ESP sends the email,
// so it is never judged on its form (merge-tag-syntax.js).
const { isDynamic } = require('./merge-tag-syntax');
const { declarationsOf } = require('./inline-style');

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

// Inline declarations that hide an element from every reader. The export has
// no stylesheet applied (DOMParser renders nothing), so class-based hiding is
// out of reach. `mso-hide:all` is not here: it hides from Outlook only, and
// the text is read everywhere else.
const HIDING = {
  display: (v) => /^none\b/i.test(v),
  visibility: (v) => /^hidden\b/i.test(v),
  opacity: (v) => Number(v) === 0,
  'max-height': (v) => /^0(px)?$/i.test(v),
};

const isHidden = (el) =>
  el.nodeType === 1 &&
  declarationsOf(el).some(
    ({ prop, value }) => HIDING[prop] && HIDING[prop](value)
  );

// Whether an element is shown: neither it nor an ancestor up to `root` hides.
function isShown(el, root) {
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    if (isHidden(node)) return false;
    if (node === root) break;
  }
  return true;
}

/**
 * The text a reader sees in an element: hidden descendants, scripts and styles
 * left out, whitespace collapsed.
 */
function visibleTextOf(root) {
  const parts = [];
  (function walk(node) {
    if (node.nodeType === 3) parts.push(node.nodeValue);
    if (node.nodeType !== 1 && node.nodeType !== 9) return;
    if (node.nodeType === 1) {
      if (/^(script|style|template)$/i.test(node.tagName) || isHidden(node)) {
        return;
      }
      // Block-level breaks keep words of two cells apart.
      if (/^(br|p|div|td|tr|li|h[1-6])$/i.test(node.tagName)) parts.push(' ');
    }
    Array.from(node.childNodes).forEach(walk);
  })(root);
  return parts.join('').replace(/\s+/g, ' ').trim();
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
