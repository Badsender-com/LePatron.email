'use strict';

const _ = require('lodash');
const { checkableLinks } = require('../resources');

// The server asks the DNS blocklists it is configured with (Spamhaus DBL,
// SURBL, URIBL…) about the registrable domain of each link. Unless the
// platform subscribed to one, the check does not run and is not listed.
const blocklists = (ctx) => _.get(ctx, 'remote.blocklists', null);

const belongsTo = (hostname, domain) =>
  hostname === domain || hostname.endsWith(`.${domain}`);

module.exports = {
  id: 'domain-blocklists',
  category: 'content',
  severity: 'warning',
  titleKey: 'Blocklisted domains',
  remote: true,
  // Runs only where the platform subscribed to a blocklist.
  optional: true,
  passKey: 'No link points to a blocklisted domain',
  enabled: (ctx) => Boolean(blocklists(ctx) && blocklists(ctx).enabled),
  run(ctx) {
    const listed = blocklists(ctx).listed || {};
    const links = checkableLinks(ctx);
    return Object.keys(listed)
      .map((domain) => {
        const link = links.find((l) => belongsTo(l.url.hostname, domain));
        return {
          messageKey:
            'Domain on a blocklist (__lists__), filters may send the email to spam: __domain__',
          params: { domain, lists: listed[domain].join(', ') },
          blockId: link ? link.blockId : null,
          value: domain,
        };
      });
  },
};
