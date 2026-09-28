'use strict';

const { blockImages, textOf } = require('../exported-content');

// Under this much readable text, an email with images blocked shows nothing,
// and filters that read content have nothing to read. Not a text/image ratio,
// which the deliverability guidelines dismiss: an email with real text passes.
const MIN_TEXT_LENGTH = 100;

module.exports = {
  id: 'image-only-email',
  category: 'content',
  severity: 'warning',
  titleKey: 'Readable text',
  passKey: 'The email has text to read when images are blocked',
  MIN_TEXT_LENGTH,
  run(ctx) {
    if (!blockImages(ctx).length) return [];
    const length = ctx.blocks
      .map((block) => ctx.doc.getElementById(block.id))
      .filter(Boolean)
      .map(textOf)
      .join(' ')
      .trim().length;
    if (length >= MIN_TEXT_LENGTH) return [];
    return [
      {
        messageKey:
          'The email has almost no text besides its images (__count__ characters): with images blocked, nothing can be read',
        params: { count: length },
        value: length,
      },
    ];
  },
};
