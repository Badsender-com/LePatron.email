'use strict';

// `#toreplace` is the default URL our templates give a link the client must
// fill in. An empty href or a bare `#` leads nowhere either.
const UNFILLED_HREFS = new Set(['#toreplace', '#', '']);

// Two rules read the same anchors: they are looked up once per run.
const anchorsByContext = new WeakMap();

/**
 * Links of the client's blocks that still lead nowhere, read from the export:
 * it only holds what is actually shown, so a hidden block is never reported.
 * Links of the template's frame (outside every block) are not the client's.
 * @returns {Array<{ anchor: Element, blockId: string, label: string }>}
 */
function findUnfilledAnchors(ctx) {
  if (!anchorsByContext.has(ctx)) {
    const anchors = Array.from(ctx.doc.querySelectorAll('a[href]'))
      .filter((a) => UNFILLED_HREFS.has(a.getAttribute('href').trim()))
      .map((anchor) => ({
        anchor,
        blockId: ctx.blockIdOf(anchor),
        label: (anchor.textContent || '').replace(/\s+/g, ' ').trim(),
      }))
      .filter((link) => link.blockId);
    anchorsByContext.set(ctx, anchors);
  }
  return anchorsByContext.get(ctx);
}

module.exports = {
  findUnfilledAnchors,
};
