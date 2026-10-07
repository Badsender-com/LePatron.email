'use strict';

// Gmail clips any message whose HTML exceeds 102 KB.
const GMAIL_CLIPPING_BYTES = 102 * 1024;

module.exports = {
  id: 'html-size',
  category: 'technical',
  severity: 'warning',
  run(ctx) {
    const bytes = new Blob([ctx.html]).size;
    if (bytes <= GMAIL_CLIPPING_BYTES) return [];
    const size = Math.ceil(bytes / 1024);
    return [
      {
        messageKey:
          'Exported HTML weighs __size__ KB: Gmail clips emails over 102 KB',
        params: { size },
        value: size,
      },
    ];
  },
};
