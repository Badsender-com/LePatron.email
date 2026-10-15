'use strict';

const { blockLinks } = require('../exported-content');
const {
  PUBLIC_SHORTENERS,
  RISKY_TLDS,
  EXAMPLE_DOMAINS,
  TEST_ENVIRONMENT_LABEL,
} = require('./link-lists');

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const PUNYCODE_LABEL = /(^|\.)xn--/i;

// The authority as the client typed it ("café.fr", "user@brand.com"): the
// parsed hostname shows an accented domain as punycode, which names nothing
// to them.
const typedAuthority = (href) =>
  (/^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(href) || [])[1] || '';

/**
 * What makes a link's domain suspicious to a filter or a reader, or null. The
 * first reason found wins: one finding per link.
 * @param {URL} url
 * @param {string} typed - the authority as typed
 * @returns {{ messageKey: string, severity?: string }|null}
 */
function reasonOf(url, typed) {
  const host = url.hostname.toLowerCase();
  const labels = host.split('.');
  if (url.username || url.password) {
    return {
      messageKey: 'Link address hides an identity before its domain: __host__',
    };
  }
  if (IPV4.test(host) || host.startsWith('[')) {
    return {
      messageKey: 'Link points to an IP address instead of a domain: __host__',
    };
  }
  // Subdomains only: `.dev` is a real extension, `test.fr` a real domain.
  const subdomains = labels.slice(0, -2);
  if (
    host === 'localhost' ||
    subdomains.some((label) => TEST_ENVIRONMENT_LABEL.test(label))
  ) {
    return { messageKey: 'Link points to a test environment: __host__' };
  }
  const domain = labels.slice(-2).join('.');
  if (EXAMPLE_DOMAINS.has(domain)) {
    return { messageKey: 'Link points to an example domain: __host__' };
  }
  if (PUBLIC_SHORTENERS.has(host) || PUBLIC_SHORTENERS.has(domain)) {
    return { messageKey: 'Public URL shortener: __host__' };
  }
  if (RISKY_TLDS.has(labels[labels.length - 1])) {
    return { messageKey: 'Domain extension often used for spam: __host__' };
  }
  // Punycode typed as is may hide a look-alike domain; an accented domain the
  // client typed themselves is only worth a glance.
  if (PUNYCODE_LABEL.test(typed)) {
    return {
      messageKey:
        'Internationalized domain, check it is the expected one: __host__',
    };
  }
  if (labels.some((label) => label.startsWith('xn--'))) {
    return {
      messageKey:
        'Internationalized domain, check it is the expected one: __host__',
      severity: 'info',
    };
  }
  return null;
}

module.exports = {
  id: 'suspicious-links',
  category: 'content',
  severity: 'warning',
  titleKey: 'Link domains',
  passKey: 'No link points to a suspicious domain',
  run(ctx) {
    return blockLinks(ctx)
      .filter(
        (link) =>
          link.url && !link.dynamicHost && /^https?:$/.test(link.url.protocol)
      )
      .map((link) => {
        const typed = typedAuthority(link.href);
        return { link, typed, reason: reasonOf(link.url, typed) };
      })
      .filter((found) => found.reason)
      .map(({ link, typed, reason }) => ({
        ...reason,
        params: { host: typed || link.url.hostname },
        blockId: link.blockId,
        value: link.href,
      }));
  },
};
