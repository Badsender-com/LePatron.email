'use strict';

const { blockLinks } = require('../exported-content');

// A link whose visible text is an address: "www.brand.com", "https://…".
const URL_LIKE_TEXT = /^(https?:\/\/\S+|www\.\S+|[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?)$/i;

// Once the ESP rewrites every link through its tracking domain, the address a
// reader sees no longer matches where the link goes: the classic phishing
// pattern filters look for, B2B gateways first.
module.exports = {
  id: 'displayed-urls',
  category: 'content',
  severity: 'warning',
  titleKey: 'Addresses shown as link text',
  passKey: 'No link shows an address as its text',
  run(ctx) {
    return blockLinks(ctx)
      .filter((link) => !link.dynamic && URL_LIKE_TEXT.test(link.text))
      .map((link) => ({
        messageKey:
          'Link text is an address (__label__): once the ESP rewrites links for tracking, it no longer matches its destination and can look like phishing',
        params: { label: link.text },
        blockId: link.blockId,
        value: link.text,
      }));
  },
};
