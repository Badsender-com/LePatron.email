'use strict';

const { checkableImages, remoteImage } = require('../resources');

// Twice the width it is shown at covers retina screens; more is weight every
// reader downloads for nothing. The shown width is the template's `width`
// attribute: an image without one is not judged.
const MAX_RATIO = 2;

function shownWidth(img) {
  const width = parseInt(img.getAttribute('width'), 10);
  return width > 0 ? width : null;
}

module.exports = {
  id: 'oversized-images',
  category: 'performance',
  severity: 'info',
  titleKey: 'Image dimensions',
  remote: true,
  enabled: (ctx) =>
    checkableImages(ctx).some((image) => {
      const result = remoteImage(ctx, image.src);
      return result && result.width;
    }),
  passKey: 'No image is much larger than it is shown',
  run(ctx) {
    return checkableImages(ctx)
      .map((image) => ({
        image,
        result: remoteImage(ctx, image.src),
        shown: shownWidth(image.img),
      }))
      .filter(
        ({ result, shown }) =>
          shown && result && result.width && result.width > MAX_RATIO * shown
      )
      .map(({ image, result, shown }) => ({
        messageKey: 'Image is __width__ px wide, shown at __shown__ px',
        params: { width: result.width, shown },
        blockId: image.blockId,
        value: image.src,
      }));
  },
};
