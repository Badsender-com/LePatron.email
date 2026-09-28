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

module.exports = { blockLinks, blockImages, isDynamic, parseUrl, textOf };
