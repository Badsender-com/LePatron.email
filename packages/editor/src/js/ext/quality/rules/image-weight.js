'use strict';

const { checkableImages, remoteImage } = require('../resources');

// Weighed by the server on the image the export ships: for LePatron's images,
// the resized or cropped one the export downloads. Deliverability guides put
// the ceiling of one image at 500 KB; an animated GIF gets 1 MB.
const MAX_IMAGE_BYTES = 500 * 1024;
const MAX_GIF_BYTES = 1024 * 1024;

const kb = (result) =>
  `${Math.round(result.bytes / 1024)}${result.atLeast ? '+' : ''}`;

const isGif = (result, src) =>
  result.type === 'gif' || /\.gif($|\?)/i.test(src || '');

// `kind` joins the fingerprint: ignoring "could not be downloaded" must not
// hide a later "heavy image" on the same address.
function problemOf(image, result) {
  if (result.state === 'unreachable') {
    return {
      kind: 'missing',
      messageKey:
        'Image could not be downloaded: the export will leave it out (__name__)',
      params: { name: image.src.split('/').pop().split('?')[0] },
    };
  }
  if (isGif(result, image.src)) {
    return result.bytes > MAX_GIF_BYTES
      ? {
          kind: 'heavy',
          messageKey: 'Heavy GIF (__size__ KB): keep it under 1 MB',
          params: { size: kb(result) },
        }
      : null;
  }
  return result.bytes > MAX_IMAGE_BYTES
    ? {
        kind: 'heavy',
        messageKey: 'Heavy image (__size__ KB): keep it under 500 KB',
        params: { size: kb(result) },
      }
    : null;
}

// "unverifiable": an address the server refuses to reach (a private
// network). The export may well get it: not judged.
const measured = (ctx) =>
  checkableImages(ctx)
    .map((image) => ({ image, result: remoteImage(ctx, image.src) }))
    .filter(({ result }) => result && result.state !== 'unverifiable');

module.exports = {
  id: 'image-weight',
  category: 'performance',
  severity: 'warning',
  titleKey: 'Image weight',
  remote: true,
  MAX_IMAGE_BYTES,
  enabled: (ctx) => measured(ctx).length > 0,
  passKey: 'Images checked: __count__, each under 500 KB',
  passParams: (ctx) => ({
    count: new Set(measured(ctx).map(({ image }) => image.src)).size,
  }),
  run(ctx) {
    return measured(ctx)
      .map(({ image, result }) => {
        const problem = problemOf(image, result);
        if (!problem) return null;
        const { kind, ...finding } = problem;
        return { ...finding, blockId: image.blockId, value: `${kind}|${image.src}` };
      })
      .filter(Boolean);
  },
};
