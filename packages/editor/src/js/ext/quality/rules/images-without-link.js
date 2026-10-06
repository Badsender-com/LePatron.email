'use strict';

const { findUnfilledAnchors } = require('../links');
const { isPlaceholderSrc } = require('../images');

// The template wraps this image in a link it expects the client to fill in
// (`#toreplace` by convention), and the link still leads nowhere. A link left
// empty in a `data-ko-link` is not exported at all, the image is then simply
// not clickable, and nothing is reported (team decision of 1 October 2026).
// An empty `href` that the export keeps (`-ko-attr-href`) stays clickable,
// and is reported.
module.exports = {
  id: 'images-without-link',
  category: 'content',
  severity: 'warning',
  titleKey: 'Clickable images',
  passKey: 'Every clickable image has a link',
  run(ctx) {
    const { placeholderUrl } = ctx.config;
    return (
      findUnfilledAnchors(ctx)
        .filter((link) => !link.label && link.anchor.querySelector('img'))
        .map((link) => ({
          link,
          src: link.anchor.querySelector('img').getAttribute('src'),
        }))
        // An image never replaced is already an error (unreplaced-images): its
        // link is the next thing to fix, not a second report on the same image.
        .filter(({ src }) => !isPlaceholderSrc(src, placeholderUrl))
        .map(({ link, src }) => ({
          messageKey: 'Clickable image has no link',
          blockId: link.blockId,
          value: src,
        }))
    );
  },
};
