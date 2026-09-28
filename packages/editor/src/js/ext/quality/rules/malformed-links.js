'use strict';

const { blockLinks } = require('../exported-content');
const { isUnfilled } = require('./unfilled-links');

const KNOWN_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:', 'sms:']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ().-]{3,}$/;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const LOOKS_LIKE_DOMAIN = /^(www\.|[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$))/i;

// A badly encoded address (a lone "%") must not stop the check.
const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
};

/**
 * Why a link URL cannot work, or null. Merge tags, in-email anchors (#top) and
 * the links "unfilled-links" reports are never judged here.
 */
function problemOf(link) {
  const { href } = link;
  if (link.dynamic || isUnfilled(href) || href.startsWith('#')) return null;
  if (!HAS_SCHEME.test(href)) {
    return LOOKS_LIKE_DOMAIN.test(href)
      ? 'Link URL misses http:// or https://: __url__'
      : 'Link URL is not a full address: __url__';
  }
  const scheme = href.slice(0, href.indexOf(':') + 1).toLowerCase();
  if (!KNOWN_SCHEMES.has(scheme)) {
    return 'Link URL has an unknown protocol: __url__';
  }
  const rest = safeDecode(href.slice(scheme.length).split('?')[0]);
  if (scheme === 'mailto:' && !EMAIL.test(rest)) {
    return 'Email link has no valid address: __url__';
  }
  if ((scheme === 'tel:' || scheme === 'sms:') && !PHONE.test(rest)) {
    return 'Phone link has no valid number: __url__';
  }
  if (!scheme.startsWith('http')) return null;
  // A space breaks a web address; a phone number may well carry some.
  if (/\s/.test(href)) return 'Link URL contains a space: __url__';
  const host = link.url ? link.url.hostname : '';
  // localhost is reported by "suspicious-links", as a test environment.
  if (host !== 'localhost' && !host.includes('.')) {
    return 'Link URL is not a full address: __url__';
  }
  return null;
}

module.exports = {
  id: 'malformed-links',
  category: 'content',
  severity: 'warning',
  titleKey: 'Link addresses',
  passKey: 'Every link address is well formed',
  run(ctx) {
    return blockLinks(ctx)
      .map((link) => ({ link, messageKey: problemOf(link) }))
      .filter((found) => found.messageKey)
      .map(({ link, messageKey }) => ({
        messageKey,
        params: { url: link.href },
        blockId: link.blockId,
        value: link.href,
      }));
  },
};
