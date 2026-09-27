'use strict';

const _ = require('lodash');
const { TRANSPARENT_GIF, getBlockDefault } = require('../ownership');

// An editable image left empty is exported as the image backend's placeholder
// (`…?method=placeholder&params=W,H`, see app.js), or without any src.
function isPlaceholderSrc(src) {
  return !src || src === TRANSPARENT_GIF || /[?&]method=placeholder\b/.test(src);
}

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

module.exports = {
  id: 'unreplaced-images',
  category: 'content',
  severity: 'error',
  isPlaceholderSrc,
  run(ctx) {
    // Placeholders actually shown in the client's blocks.
    const placeholders = Array.from(ctx.doc.querySelectorAll('img'))
      .filter((img) => isPlaceholderSrc(img.getAttribute('src')))
      .map((img) => ({ img, blockId: ctx.blockIdOf(img) }))
      .filter((found) => found.blockId)
      .map((found) => ({
        messageKey: 'Image not replaced',
        blockId: found.blockId,
        value: found.img.getAttribute('src'),
      }));

    // Sample images: the template's own default picture, never changed. Only
    // those still shown in the export count (the image may be hidden).
    const samples = _.flatMap(ctx.blocks, (block) => {
      const def = getBlockDefault(ctx.blockDefs, block && block.type);
      if (!def) return [];
      const shown = Array.from(ctx.doc.querySelectorAll('img')).filter(
        (img) => ctx.blockIdOf(img) === block.id
      );
      return collectImages(block)
        .filter((image) => {
          const defaultSrc = _.get(def, image.path.concat('src'));
          return (
            image.src &&
            image.src === defaultSrc &&
            shown.some((img) =>
              (img.getAttribute('src') || '').startsWith(image.src)
            )
          );
        })
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
