'use strict';

const { thresholdOf } = require('../settings');
const { kbSize } = require('../message-params');

// Gmail clips any message whose HTML exceeds 102 KB: what follows, the footer
// and the open tracking pixel, hides behind "Message clipped". The warning
// comes from 100 KB by default: the ESP adds its tracking code to the HTML
// (team decision of 1 October 2026; threshold `maxKb`, set by the quality
// settings). Passing means under the threshold, so the threshold exactly is
// reported.
// A company may set its threshold above Gmail's limit: past the threshold it
// is warned of both, and between the two Gmail's clipping is only an info,
// the threshold being the company's own choice.
const GMAIL_CLIPPING_BYTES = 102 * 1024;

const kbOf = (bytes) => Math.ceil(bytes / 1024);

module.exports = {
  id: 'html-size',
  category: 'technical',
  severity: 'warning',
  titleKey: 'Email weight',
  passKey: 'Exported HTML weighs __size__ KB, under the __max__ limit',
  GMAIL_CLIPPING_BYTES,
  passParams: (ctx) => ({
    size: kbOf(new Blob([ctx.html]).size),
    max: kbSize(thresholdOf(ctx, 'html-size', 'maxKb')),
  }),
  run(ctx) {
    const bytes = new Blob([ctx.html]).size;
    const max = thresholdOf(ctx, 'html-size', 'maxKb');
    const size = kbOf(bytes);
    if (bytes >= max * 1024) {
      return [
        {
          messageKey:
            max * 1024 <= GMAIL_CLIPPING_BYTES
              ? 'Exported HTML weighs __size__ KB: keep it under __max__, Gmail clips emails over 102 KB once the ESP adds its tracking'
              : 'Exported HTML weighs __size__ KB, over the limit of __max__ set for your emails. Gmail will also clip it, as it does every email over 102 KB: the footer and the open tracking pixel will be hidden behind "Message clipped"',
          params: { size, max: kbSize(max) },
          value: size,
        },
      ];
    }
    if (bytes <= GMAIL_CLIPPING_BYTES) return [];
    return [
      {
        messageKey:
          'Exported HTML weighs __size__ KB: Gmail will clip this email, as it does every email over 102 KB; the footer and the open tracking pixel will be hidden behind "Message clipped"',
        severity: 'info',
        params: { size },
        // Ignoring the clipping must not hide the warning a lower threshold
        // would raise at the same size.
        value: `gmail-clipping|${size}`,
      },
    ];
  },
};
