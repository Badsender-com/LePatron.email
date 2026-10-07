'use strict';

const { blockImages } = require('../exported-content');
const { thresholdOf } = require('../settings');

// Beyond `maxLength` characters (quality settings), screen readers read a
// paragraph where a caption was expected.
// A camera's or a stock site's name, and nothing else: "Photo 2024 of the
// collection" describes the image.
const FILE_NAME = /\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?)$|^(img|dsc|dcim|image|photo|pxl)[-_ ]?\d+(\.[a-z0-9]+)?$/i;
const URL_LIKE = /^(https?:\/\/|www\.)/i;

// Only the form of an alternative text is judged: whether it describes the
// image is a matter of meaning, left to a later AI check. An empty alt is
// never reported here: it is right for a decorative image. The template's own
// default alt is judged with the rest: it is what the recipient hears.
function problemOf(alt, maxLength) {
  const text = (alt || '').trim();
  if (!text) return null;
  if (URL_LIKE.test(text)) return 'Alternative text is an address: __alt__';
  if (FILE_NAME.test(text)) {
    return 'Alternative text looks like a file name: __alt__';
  }
  if (text.length > maxLength) {
    return 'Alternative text is too long (__count__ characters): keep it to a short description';
  }
  return null;
}

module.exports = {
  id: 'alt-text-quality',
  category: 'accessibility',
  severity: 'info',
  titleKey: 'Alternative texts',
  passKey: 'Alternative texts look like descriptions',
  run(ctx) {
    const maxLength = thresholdOf(ctx, 'alt-text-quality', 'maxLength');
    return blockImages(ctx)
      .map((image) => ({ image, messageKey: problemOf(image.alt, maxLength) }))
      .filter((found) => found.messageKey)
      .map(({ image, messageKey }) => {
        const alt = image.alt.trim();
        return {
          messageKey,
          params: { alt, count: alt.length },
          blockId: image.blockId,
          value: alt,
        };
      });
  },
};
