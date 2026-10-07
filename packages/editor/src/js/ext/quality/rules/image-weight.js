'use strict';

const { checkableImages, remoteImage } = require('../resources');
const { thresholdOf } = require('../settings');

// Weighed by the server on the image the export ships: for LePatron's images,
// the resized or cropped one the export downloads. Deliverability guides put
// the ceiling of one image at 500 KB; an animated GIF gets 1 MB (thresholds
// `maxKb` and `maxGifKb`, set by the quality settings).

const kb = (result) =>
  `${Math.round(result.bytes / 1024)}${result.atLeast ? '+' : ''}`;

const isGif = (result, src) =>
  result.type === 'gif' || /\.gif($|\?)/i.test(src || '');

// The image is surely gone: a 404 or 410, or no such host. A 401, 403 or 429
// may only refuse the server's robot, while a reader gets the image.
const isGone = (result) =>
  [404, 410].includes(result.httpStatus) || result.reason === 'not-found';

// `kind` joins the fingerprint: ignoring "could not be downloaded" must not
// hide a later "heavy image" on the same address.
function problemOf(ctx, image, result) {
  if (result.state === 'unreachable') {
    return {
      kind: 'missing',
      // Not sure: never blocking (ADR 0004).
      uncertain: !isGone(result),
      messageKey:
        'Image could not be downloaded: the export will leave it out (__name__)',
      params: { name: image.src.split('/').pop().split('?')[0] },
    };
  }
  if (isGif(result, image.src)) {
    const maxGif = thresholdOf(ctx, 'image-weight', 'maxGifKb');
    return result.bytes > maxGif * 1024
      ? {
          kind: 'heavy',
          messageKey: 'Heavy GIF (__size__ KB): keep it under __max__ KB',
          params: { size: kb(result), max: maxGif },
        }
      : null;
  }
  const max = thresholdOf(ctx, 'image-weight', 'maxKb');
  return result.bytes > max * 1024
    ? {
        kind: 'heavy',
        messageKey: 'Heavy image (__size__ KB): keep it under __max__ KB',
        params: { size: kb(result), max },
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
  enabled: (ctx) => measured(ctx).length > 0,
  passKey: 'Images checked: __count__, each under __max__ KB',
  passParams: (ctx) => ({
    count: new Set(measured(ctx).map(({ image }) => image.src)).size,
    max: thresholdOf(ctx, 'image-weight', 'maxKb'),
  }),
  run(ctx) {
    return measured(ctx)
      .map(({ image, result }) => {
        const problem = problemOf(ctx, image, result);
        if (!problem) return null;
        const { kind, ...finding } = problem;
        return { ...finding, blockId: image.blockId, value: `${kind}|${image.src}` };
      })
      .filter(Boolean);
  },
};
