'use strict';

const { findUnfilledAnchors } = require('../links');

module.exports = {
  id: 'unfilled-links',
  category: 'content',
  severity: 'error',
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
