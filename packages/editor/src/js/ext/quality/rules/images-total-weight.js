'use strict';

const _ = require('lodash');
const { checkableImages, remoteImage } = require('../resources');
const { thresholdOf } = require('../settings');

// Everything the reader downloads for the client's images: each address once,
// as the export ships it. Badsender's grid warns past 500 KB; past 1 MB the
// email loads slowly on mobile and weighs on deliverability (thresholds
// `warningKb` and `errorKb`, set by the quality settings).

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
  passKey: 'Images weigh __size__ KB in all, under __max__ KB',
  passParams: (ctx) => ({
    size: kb(totalBytes(ctx)),
    max: thresholdOf(ctx, 'images-total-weight', 'warningKb'),
  }),
  run(ctx) {
    const total = totalBytes(ctx);
    const warningKb = thresholdOf(ctx, 'images-total-weight', 'warningKb');
    const errorKb = thresholdOf(ctx, 'images-total-weight', 'errorKb');
    if (total <= warningKb * 1024) return [];
    return [
      total > errorKb * 1024
        ? {
            severity: 'error',
            messageKey: 'Images weigh __size__ KB in all: over __max__ KB',
            params: { size: kb(total), max: errorKb },
            // The level, not the weight: an image a few bytes lighter on a
            // CDN must not bring back what the team ignored.
            value: 'over-1-mb',
          }
        : {
            messageKey: 'Images weigh __size__ KB in all: over __max__ KB',
            params: { size: kb(total), max: warningKb },
            value: 'over-500-kb',
          },
    ];
  },
};
