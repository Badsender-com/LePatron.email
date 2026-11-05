'use strict';

const _ = require('lodash');
const { checkableImages, remoteImage } = require('../resources');

// Everything the reader downloads for the client's images: each address once,
// as the export ships it. Badsender's grid warns past 500 KB; past 1 MB the
// email loads slowly on mobile and weighs on deliverability.
const WARNING_BYTES = 500 * 1024;
const ERROR_BYTES = 1024 * 1024;

const weighed = (ctx) =>
  _.uniq(checkableImages(ctx).map((image) => image.src))
    .map((src) => remoteImage(ctx, src))
    .filter((result) => result && result.state === 'ok');

const totalBytes = (ctx) => _.sumBy(weighed(ctx), 'bytes');

const kb = (bytes) => Math.round(bytes / 1024);

module.exports = {
  id: 'images-total-weight',
  category: 'performance',
  severity: 'warning',
  titleKey: 'Total image weight',
  remote: true,
  enabled: (ctx) => weighed(ctx).length > 0,
  passKey: 'Images weigh __size__ KB in all, under 500 KB',
  passParams: (ctx) => ({ size: kb(totalBytes(ctx)) }),
  run(ctx) {
    const total = totalBytes(ctx);
    if (total <= WARNING_BYTES) return [];
    return [
      total > ERROR_BYTES
        ? {
            severity: 'error',
            messageKey: 'Images weigh __size__ KB in all: over 1 MB',
            params: { size: kb(total) },
            // The level, not the weight: an image a few bytes lighter on a
            // CDN must not bring back what the team ignored.
            value: 'over-1-mb',
          }
        : {
            messageKey: 'Images weigh __size__ KB in all: over 500 KB',
            params: { size: kb(total) },
            value: 'over-500-kb',
          },
    ];
  },
};
