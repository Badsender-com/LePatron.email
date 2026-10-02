'use strict';

const { findUnfilledAnchors } = require('../links');

// The template wraps this image in a link it expects the client to fill in
// (`#toreplace` by convention), and the link still leads nowhere.
module.exports = {
  id: 'images-without-link',
  category: 'content',
  severity: 'warning',
  run(ctx) {
    return findUnfilledAnchors(ctx)
      .filter((link) => !link.label && link.anchor.querySelector('img'))
      .map((link) => ({
        messageKey: 'Clickable image has no link',
        blockId: link.blockId,
        value: link.anchor.querySelector('img').getAttribute('src'),
      }));
  },
};
