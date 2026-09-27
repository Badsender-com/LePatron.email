'use strict';

// `#toreplace` is the default URL our templates give a link the client must
// fill in. An empty href or a bare `#` leads nowhere either.
const UNFILLED_HREFS = new Set(['#toreplace', '#', '']);

/**
 * Links of the client's blocks that still lead nowhere, read from the export:
 * it only holds what is actually shown, so a hidden block is never reported.
 * Links of the template's frame (outside every block) are not the client's.
 * @returns {Array<{ anchor: Element, blockId: string, label: string }>}
 */
function findUnfilledAnchors(ctx) {
  return Array.from(ctx.doc.querySelectorAll('a[href]'))
    .filter((a) => UNFILLED_HREFS.has(a.getAttribute('href').trim()))
    .map((anchor) => ({
      anchor,
      blockId: ctx.blockIdOf(anchor),
      label: (anchor.textContent || '').replace(/\s+/g, ' ').trim(),
    }))
    .filter((link) => link.blockId);
}

module.exports = {
  id: 'unfilled-links',
  category: 'content',
  severity: 'error',
  findUnfilledAnchors,
  run(ctx) {
    // A linked image without text is reported by "images-without-link".
    return findUnfilledAnchors(ctx)
      .filter((link) => link.label)
      .map((link) => ({
        messageKey: 'Link not filled in: __label__',
        params: { label: link.label },
        blockId: link.blockId,
        value: link.label,
      }));
  },
};
