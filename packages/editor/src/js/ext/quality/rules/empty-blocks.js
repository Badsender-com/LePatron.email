'use strict';

const _ = require('lodash');
const { getBlockDefault } = require('../ownership');
const { blockTexts, blockImages } = require('../exported-content');

// Text properties of a model, by the naming convention of our templates
// (titleText, longText, buttonText…), with something to read by default.
const TEXT_KEY = /text$/i;
const hasDefaultText = (value, key) => {
  if (typeof value === 'string') {
    return TEXT_KEY.test(key || '') && /\p{L}/u.test(value.replace(/<[^>]*>/g, ''));
  }
  return (
    !!value &&
    typeof value === 'object' &&
    Object.keys(value).some((k) => hasDefaultText(value[k], k))
  );
};

// A block that shows nothing: no text, no image. Spacers and dividers have no
// text to begin with and are left alone: only a block whose template ships
// text, and which the client emptied, is reported.
module.exports = {
  id: 'empty-blocks',
  category: 'copy',
  severity: 'warning',
  titleKey: 'Empty blocks',
  passKey: 'Every block shows something',
  run(ctx) {
    const texts = blockTexts(ctx);
    const withImages = new Set(blockImages(ctx).map((image) => image.blockId));
    return ctx.blocks
      .filter((block) => block && block.id in texts)
      .filter((block) => !texts[block.id] && !withImages.has(block.id))
      .filter((block) =>
        hasDefaultText(_.omit(getBlockDefault(ctx.blockDefs, block.type), 'id'))
      )
      .map((block) => ({
        messageKey: 'Empty block: it shows no text and no image',
        blockId: block.id,
      }));
  },
};
