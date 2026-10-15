'use strict';

// Gmail clips any message whose HTML exceeds 102 KB. The warning comes from
// 100 KB: the ESP adds its tracking code to the HTML (team decision of
// 1 October 2026). Passing means under 100 KB, so 100 KB exactly is reported.
const WARNING_BYTES = 100 * 1024;

module.exports = {
  id: 'html-size',
  category: 'technical',
  severity: 'warning',
  titleKey: 'Email weight',
  passKey: 'Exported HTML weighs __size__ KB, under the 100 KB limit',
  WARNING_BYTES,
  passParams: (ctx) => ({ size: Math.ceil(new Blob([ctx.html]).size / 1024) }),
  run(ctx) {
    const bytes = new Blob([ctx.html]).size;
    if (bytes < WARNING_BYTES) return [];
    const size = Math.ceil(bytes / 1024);
    return [
      {
        messageKey:
          'Exported HTML weighs __size__ KB: keep it under 100 KB, Gmail clips emails over 102 KB once the ESP adds its tracking',
        params: { size },
        value: size,
      },
    ];
  },
};
