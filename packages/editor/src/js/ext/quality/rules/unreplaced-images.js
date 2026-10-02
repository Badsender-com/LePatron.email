'use strict';

const _ = require('lodash');
const { getBlockDefault } = require('../ownership');
const { fileNameOf, isPlaceholderSrc } = require('../images');

// Every image of a block model: objects carrying a `src` (image widgets).
function collectImages(value, path = []) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return _.flatMap(value, (item, i) => collectImages(item, path.concat(i)));
  }
  const own = typeof value.src === 'string' ? [{ path, src: value.src }] : [];
  return own.concat(
    _.flatMap(Object.keys(value), (key) =>
      collectImages(value[key], path.concat(key))
    )
  );
}

// The exported images of the client's blocks, by block id. Images of the
// template's frame, outside every block, are left out.
function exportedImagesByBlock(ctx) {
  return _.groupBy(
    Array.from(ctx.doc.querySelectorAll('img'))
      .map((img) => ({ blockId: ctx.blockIdOf(img), src: img.getAttribute('src') }))
      .filter((img) => img.blockId),
    'blockId'
  );
}

module.exports = {
  id: 'unreplaced-images',
  category: 'content',
  severity: 'error',
  run(ctx) {
    const shownByBlock = exportedImagesByBlock(ctx);
    const { placeholderUrl } = ctx.config;

    // Placeholders actually shown in the client's blocks.
    const placeholders = _.flatMap(Object.values(shownByBlock), (images) =>
      images
        .filter((img) => isPlaceholderSrc(img.src, placeholderUrl))
        .map((img) => ({
          messageKey: 'Image not replaced',
          blockId: img.blockId,
          value: img.src,
        }))
    );

    // Sample images: the template's own default picture, never changed. Only
    // those still shown in the export count (the image may be hidden).
    const samples = _.flatMap(ctx.blocks, (block) => {
      const def = getBlockDefault(ctx.blockDefs, block && block.type);
      const shown = shownByBlock[block && block.id] || [];
      if (!def || !shown.length) return [];
      const isShown = (src) => {
        const fileName = fileNameOf(src);
        return (
          Boolean(fileName) &&
          shown.some((img) => fileNameOf(img.src) === fileName)
        );
      };
      return collectImages(block)
        .filter(
          (image) =>
            image.src &&
            image.src === _.get(def, image.path.concat('src')) &&
            isShown(image.src)
        )
        .map((image) => ({
          messageKey: 'Template sample image not replaced',
          severity: 'warning',
          blockId: block.id,
          propertyPath: image.path.concat('src').join('.'),
          value: image.src,
        }));
    });

    return placeholders.concat(samples);
  },
};
