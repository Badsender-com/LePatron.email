'use strict';

const { blockImages, blockTexts } = require('../exported-content');
const { thresholdOf } = require('../settings');

// Under this much readable text, an email with images blocked shows nothing,
// and filters that read content have nothing to read. Not a text/image ratio,
// which the deliverability guidelines dismiss: an email with real text passes.
// Only the text a reader sees counts: hidden text reads to nobody.

module.exports = {
  id: 'image-only-email',
  category: 'content',
  severity: 'warning',
  titleKey: 'Readable text',
  passKey: 'The email has text to read when images are blocked',
  run(ctx) {
    if (!blockImages(ctx).length) return [];
    const length = Object.values(blockTexts(ctx)).join(' ').trim().length;
    if (length >= thresholdOf(ctx, 'image-only-email', 'minTextLength')) {
      return [];
    }
    return [
      {
        messageKey:
          'The email has almost no text besides its images (__count__ characters): with images blocked, nothing can be read',
        params: { count: length },
        // One advice for the whole email: the count changes at every
        // keystroke, and ignoring the advice must last.
        value: null,
      },
    ];
  },
};
