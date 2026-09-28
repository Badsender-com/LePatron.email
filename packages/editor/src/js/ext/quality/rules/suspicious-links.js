'use strict';

const { blockLinks } = require('../exported-content');
const {
  PUBLIC_SHORTENERS,
  RISKY_TLDS,
  EXAMPLE_DOMAINS,
  TEST_ENVIRONMENT_LABEL,
} = require('./link-lists');

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * What makes a link's domain suspicious to a filter or a reader, or null. The
 * first reason found wins: one finding per link.
 * @param {URL} url
 */
function reasonOf(url) {
  const host = url.hostname.toLowerCase();
  const labels = host.split('.');
  if (url.username || url.password) {
    return 'Link address hides an identity before its domain: __host__';
  }
  if (IPV4.test(host) || host.startsWith('[')) {
    return 'Link points to an IP address instead of a domain: __host__';
  }
  // Subdomains only: `.dev` is a real extension, `test.fr` a real domain.
  const subdomains = labels.slice(0, -2);
  if (
    host === 'localhost' ||
    subdomains.some((label) => TEST_ENVIRONMENT_LABEL.test(label))
  ) {
    return 'Link points to a test environment: __host__';
  }
  const domain = labels.slice(-2).join('.');
  if (EXAMPLE_DOMAINS.has(domain)) {
    return 'Link points to an example domain: __host__';
  }
  if (PUBLIC_SHORTENERS.has(host) || PUBLIC_SHORTENERS.has(domain)) {
    return 'Public URL shortener: __host__';
  }
  if (RISKY_TLDS.has(labels[labels.length - 1])) {
    return 'Domain extension often used for spam: __host__';
  }
  if (labels.some((label) => label.startsWith('xn--'))) {
    return 'Internationalized domain, check it is the expected one: __host__';
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
        (link) => !link.dynamic && link.url && /^https?:$/.test(link.url.protocol)
      )
      .map((link) => ({ link, messageKey: reasonOf(link.url) }))
      .filter((found) => found.messageKey)
      .map(({ link, messageKey }) => ({
        messageKey,
        params: { host: link.url.hostname },
        blockId: link.blockId,
        value: link.href,
      }));
  },
};
