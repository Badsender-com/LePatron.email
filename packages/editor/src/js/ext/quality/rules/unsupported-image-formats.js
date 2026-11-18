'use strict';

const { blockImages } = require('../exported-content');
const { checkableImages, remoteImage } = require('../resources');

// Formats a part of the audience cannot see (caniemail): Outlook for Windows
// shows no WebP, few clients show AVIF, HEIC or TIFF, and SVG is stripped by
// Gmail. LePatron's upload accepts WebP (bindings/fileupload.js) and keeps an
// SVG as uploaded: the image backend only rasterises it to PNG when it
// resizes or crops it (image.controller.js, rasterizeVector), so an SVG
// placed at its own size is sent as SVG.
const UNSUPPORTED = new Set([
  'webp',
  'avif',
  'heic',
  'heif',
  'tif',
  'tiff',
  'svg',
]);

function formatOf(image) {
  if (!image.src) return null;
  const dataUri = /^data:image\/([a-z0-9+.-]+)/i.exec(image.src);
  if (dataUri) return dataUri[1].toLowerCase().replace('+xml', '');
  const path = image.url ? image.url.pathname : image.src.split(/[?#]/)[0];
  const ext = /\.([a-z0-9]+)$/i.exec(path);
  return ext ? ext[1].toLowerCase() : null;
}

// The images whose address names no format: the server reads their type.
const unnamedImages = (ctx) =>
  checkableImages(ctx).filter((image) => !formatOf(image));

const MESSAGE_KEY =
  'Image format not shown by every email client (__format__): prefer JPG, PNG or GIF';

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
        messageKey: MESSAGE_KEY,
        params: { format: format.toUpperCase() },
        blockId: image.blockId,
        value: image.src,
      }));
  },
  // Once the server answered: an address that names no format (a CDN's
  // /img/12345) is judged by the type the server read in the image it
  // weighed. The server asks for the image with `Accept: */*`, as a client
  // that takes any format, so its answer is a fair guess of what readers
  // get; a CDN may still pick the format per client, and these findings
  // never block, out of prudence. Not judged: an image the server could not
  // read (unreachable, or over its size cap, with no type). When the server
  // fails, the check is listed as not run (remote-checks.js).
  // What it has the server read (resources.js): only those images, and only
  // while a server check reads the images.
  remoteImages: unnamedImages,
  remoteRun(ctx) {
    return unnamedImages(ctx)
      .map((image) => ({ image, result: remoteImage(ctx, image.src) }))
      .filter(
        ({ result }) =>
          result &&
          result.state === 'ok' &&
          typeof result.type === 'string' &&
          UNSUPPORTED.has(result.type.toLowerCase())
      )
      .map(({ image, result }) => ({
        messageKey: MESSAGE_KEY,
        params: { format: result.type.toUpperCase() },
        blockId: image.blockId,
        value: image.src,
        uncertain: true,
      }));
  },
};
