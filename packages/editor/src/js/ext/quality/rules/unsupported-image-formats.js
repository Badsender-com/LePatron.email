'use strict';

const { blockImages } = require('../exported-content');

// Formats a part of the audience cannot see (caniemail): Outlook for Windows
// shows no WebP, few clients show AVIF, HEIC or TIFF, and SVG is stripped by
// Gmail. LePatron's upload accepts WebP (bindings/fileupload.js) and turns SVG
// into PNG, so WebP and external URLs are what this finds in practice.
const UNSUPPORTED = new Set(['webp', 'avif', 'heic', 'heif', 'tif', 'tiff', 'svg']);

function formatOf(image) {
  if (!image.src) return null;
  const dataUri = /^data:image\/([a-z0-9+.-]+)/i.exec(image.src);
  if (dataUri) return dataUri[1].toLowerCase().replace('+xml', '');
  const path = image.url ? image.url.pathname : image.src.split(/[?#]/)[0];
  const ext = /\.([a-z0-9]+)$/i.exec(path);
  return ext ? ext[1].toLowerCase() : null;
}

module.exports = {
  id: 'unsupported-image-formats',
  category: 'technical',
  severity: 'warning',
  titleKey: 'Image formats',
  passKey: 'Every image uses a format email clients show',
  run(ctx) {
    return blockImages(ctx)
      .map((image) => ({ image, format: formatOf(image) }))
      .filter(({ format }) => format && UNSUPPORTED.has(format))
      .map(({ image, format }) => ({
        messageKey:
          'Image format not shown by every email client (__format__): prefer JPG, PNG or GIF',
        params: { format: format.toUpperCase() },
        blockId: image.blockId,
        value: image.src,
      }));
  },
};
