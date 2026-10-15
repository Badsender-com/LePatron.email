'use strict';

const { blockLinks } = require('./exported-content');

// `#toreplace` is the default URL our templates give a link the client must
// fill in. An empty href, a bare `#` or a `javascript:` URL leads nowhere
// either: email clients do not run scripts.
const UNFILLED_HREFS = new Set(['#toreplace', '#', '']);
const isUnfilled = (href) =>
  UNFILLED_HREFS.has(href) || /^javascript:/i.test(href);

/**
 * Links of the client's blocks that still lead nowhere, read from the export:
 * it only holds what is actually shown, so a hidden block is never reported.
 * Links of the template's frame (outside every block) are not the client's.
 * Two rules read them: looked up once per run.
 * @returns {Array<{ anchor: Element, blockId: string, label: string }>}
 */
function findUnfilledAnchors(ctx) {
  if (!ctx.cache.unfilledAnchors) {
    ctx.cache.unfilledAnchors = blockLinks(ctx)
      .filter((link) => isUnfilled(link.href))
      .map(({ anchor, blockId, text }) => ({ anchor, blockId, label: text }));
  }
  return ctx.cache.unfilledAnchors;
}

module.exports = {
  findUnfilledAnchors,
  isUnfilled,
};
