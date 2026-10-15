'use strict';

const _ = require('lodash');
const { getBlockDefault, isImageUnset } = require('../ownership');
const { blockTexts, blockImages, isShown } = require('../exported-content');
const { hasBackgroundImage } = require('./background-images');
const {
  isTranslatableFieldName,
} = require('../../../utils/block-content-extractor');

// Text properties of a model, by the naming convention of our templates
// (block-content-extractor.js: titleText, label, caption, heading…), with
// something to read by default. An alternative text is read, not shown.
const isTextKey = (key) =>
  isTranslatableFieldName(key || '') && !/alt$/i.test(key || '');
const hasDefaultText = (value, key) => {
  if (typeof value === 'string') {
    return isTextKey(key) && /\p{L}/u.test(value.replace(/<[^>]*>/g, ''));
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
    // An image shows when it is in sight and is one: a hidden `<img>` or the
    // blank GIF templates use as a spacer shows nothing.
    const withImages = new Set(
      blockImages(ctx)
        .filter(
          (image) =>
            !isImageUnset(image.src) &&
            isShown(image.img, ctx.doc.getElementById(image.blockId))
        )
        .map((image) => image.blockId)
    );
    return ctx.blocks
      .filter((block) => block && block.id in texts)
      .filter((block) => !texts[block.id] && !withImages.has(block.id))
      .filter((block) => !hasBackgroundImage(ctx, block))
      .filter((block) =>
        hasDefaultText(_.omit(getBlockDefault(ctx.blockDefs, block.type), 'id'))
      )
      .map((block) => ({
        messageKey: 'Empty block: it shows no text and no image',
        blockId: block.id,
      }));
  },
};
