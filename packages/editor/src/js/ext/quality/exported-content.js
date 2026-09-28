'use strict';

// What the client's blocks put in the export: their links and images, read once
// per run from the parsed HTML. The template's frame, outside every block, is
// never part of it.

// ESP merge tags and personalization variables: {{x}}, %%x%%, *|X|*, [[x]],
// [unsubscribe_link], ${x}. A URL carrying one is only known once the ESP sends
// the email, so it is never judged on its form.
const DYNAMIC_PATTERN = /\{\{|\}\}|%%|\*\||\|\*|\[\[|\]\]|\$\{|\[[a-z0-9_-]+\]/i;

const isDynamic = (value) => DYNAMIC_PATTERN.test(value || '');

const textOf = (node) => (node.textContent || '').replace(/\s+/g, ' ').trim();

// A URL parsed without throwing, or null.
function parseUrl(value) {
  try {
    return new URL(value);
  } catch (e) {
    return null;
  }
}

/**
 * Links of the client's blocks.
 * @returns {Array<{ anchor: Element, blockId: string, href: string,
 *   text: string, url: URL|null, dynamic: boolean }>}
 */
function blockLinks(ctx) {
  if (!ctx.cache.blockLinks) {
    ctx.cache.blockLinks = Array.from(ctx.doc.querySelectorAll('a[href]'))
      .map((anchor) => {
        const href = anchor.getAttribute('href').trim();
        return {
          anchor,
          blockId: ctx.blockIdOf(anchor),
          href,
          text: textOf(anchor),
          url: parseUrl(href),
          dynamic: isDynamic(href),
        };
      })
      .filter((link) => link.blockId);
  }
  return ctx.cache.blockLinks;
}

/**
 * Images of the client's blocks.
 * @returns {Array<{ img: Element, blockId: string, src: string|null,
 *   alt: string|null, url: URL|null }>}
 */
function blockImages(ctx) {
  if (!ctx.cache.blockImages) {
    ctx.cache.blockImages = Array.from(ctx.doc.querySelectorAll('img'))
      .map((img) => {
        const src = img.getAttribute('src');
        return {
          img,
          blockId: ctx.blockIdOf(img),
          src,
          alt: img.getAttribute('alt'),
          url: src ? parseUrl(src) : null,
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
  const imagesUrl =
    (ctx.viewModel.metadata && ctx.viewModel.metadata.imagesUrl) || {};
  return Object.values(imagesUrl).some(
    (prefix) => typeof prefix === 'string' && prefix && (src || '').startsWith(prefix)
  );
}

// Inline styles that hide an element. The export has no stylesheet applied
// (DOMParser renders nothing), so class-based hiding is out of reach.
const HIDDEN_STYLE = /(^|;)\s*(display\s*:\s*none|visibility\s*:\s*hidden|mso-hide\s*:\s*all|opacity\s*:\s*0(\.0+)?\s*(;|$)|max-height\s*:\s*0(px)?\s*(;|$))/i;

const isHidden = (el) =>
  el.nodeType === 1 && HIDDEN_STYLE.test(el.getAttribute('style') || '');

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
  blockLinks,
  blockImages,
  blockTexts,
  isDynamic,
  isPlatformImage,
  parseUrl,
  textOf,
  visibleTextOf,
};
