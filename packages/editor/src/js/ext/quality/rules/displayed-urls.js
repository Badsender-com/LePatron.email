'use strict';

const { blockLinks } = require('../exported-content');

// A link whose visible text is an address: "www.brand.com", "https://…".
const SCHEME_OR_WWW = /^(https?:\/\/\S+|www\.\S+)$/i;
// A bare domain is lowercase: "Mr.Bricolage", "St.Michel" or "Mode.Femme" are
// names, "brand.fr" is an address.
const BARE_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/;
const isUrlLike = (text) => SCHEME_OR_WWW.test(text) || BARE_DOMAIN.test(text);

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
      .filter((link) => !link.dynamic && isUrlLike(link.text))
      .map((link) => ({
        messageKey:
          'Link text is an address (__label__): once the ESP rewrites links for tracking, it no longer matches its destination and can look like phishing',
        params: { label: link.text },
        blockId: link.blockId,
        value: link.text,
      }));
  },
};
