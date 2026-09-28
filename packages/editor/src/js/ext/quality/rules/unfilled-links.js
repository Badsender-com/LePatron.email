'use strict';

const { blockLinks } = require('../exported-content');

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
 * @returns {Array<{ anchor: Element, blockId: string, label: string }>}
 */
function findUnfilledAnchors(ctx) {
  return blockLinks(ctx)
    .filter((link) => isUnfilled(link.href))
    .map((link) => ({
      anchor: link.anchor,
      blockId: link.blockId,
      label: link.text,
    }));
}

module.exports = {
  id: 'unfilled-links',
  category: 'content',
  severity: 'error',
  findUnfilledAnchors,
  isUnfilled,
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
