'use strict';

const { thresholdOf } = require('../settings');

// Gmail clips any message whose HTML exceeds 102 KB. The warning comes at
// 100 KB: the ESP adds its tracking code to the HTML (team decision of
// 1 October 2026; threshold `maxKb`, set by the quality settings).
const GMAIL_CLIPPING_BYTES = 102 * 1024;

module.exports = {
  id: 'html-size',
  category: 'technical',
  severity: 'warning',
  titleKey: 'Email weight',
  passKey: 'Exported HTML weighs __size__ KB, under the __max__ KB limit',
  GMAIL_CLIPPING_BYTES,
  passParams: (ctx) => ({
    size: Math.ceil(new Blob([ctx.html]).size / 1024),
    max: thresholdOf(ctx, 'html-size', 'maxKb'),
  }),
  run(ctx) {
    const bytes = new Blob([ctx.html]).size;
    const max = thresholdOf(ctx, 'html-size', 'maxKb');
    if (bytes <= max * 1024) return [];
    const size = Math.ceil(bytes / 1024);
    return [
      {
        messageKey:
          'Exported HTML weighs __size__ KB: keep it under __max__ KB, Gmail clips emails over 102 KB once the ESP adds its tracking',
        params: { size, max },
        value: size,
      },
    ];
  },
};
