'use strict';

const { getBlockDefault, isImageUnset } = require('../ownership');
const { blockTexts, blockImages, isShown } = require('../exported-content');
const { hasBackgroundImage } = require('./background-images');
const { listTextFields } = require('../../block-text-fields');

// The template ships text for a block when its definition holds a text field
// (the one listing of a block's text, #1253) whose visible text has a letter.
// Every field a reader sees counts, a lone merge tag or an address too, not
// only what translation translates. An alternative text is read, not shown.
const shipsText = (blockDef) =>
  listTextFields(blockDef, { untranslatable: true }).some(
    (field) => field.role !== 'alt' && /\p{L}/u.test(field.text)
  );

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
      .filter((block) => shipsText(getBlockDefault(ctx.blockDefs, block.type)))
      .map((block) => ({
        messageKey: 'Empty block: it shows no text and no image',
        blockId: block.id,
      }));
  },
};
