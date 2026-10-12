'use strict';

const _ = require('lodash');
const { checkableLinks } = require('../resources');

// The server asks the DNS blocklists it is configured with (Spamhaus DBL,
// SURBL, URIBL…) about the registrable domain of each link. Unless the
// platform subscribed to one, the check does not run and is not listed.
const blocklists = (ctx) => _.get(ctx, 'remote.blocklists', null);

// The domains the blocklists could not be asked about (a resolver down, a
// refused query, out of time): they are not "clean".
const unchecked = (ctx) => _.get(blocklists(ctx), 'unchecked', []);

const belongsTo = (hostname, domain) =>
  hostname === domain || hostname.endsWith(`.${domain}`);

const linkOf = (links, domain) =>
  links.find((l) => belongsTo(l.url.hostname, domain));

module.exports = {
  id: 'domain-blocklists',
  category: 'content',
  severity: 'warning',
  titleKey: 'Blocklisted domains',
  remote: true,
  // Runs only where the platform subscribed to a blocklist.
  optional: true,
  passKey: 'No link points to a blocklisted domain',
  enabled(ctx) {
    if (!blocklists(ctx) || !blocklists(ctx).enabled) return false;
    // The blocklists answered for no link's domain: the check did not run.
    const links = checkableLinks(ctx);
    const skipped = unchecked(ctx);
    return !(
      links.length > 0 &&
      links.every((l) => skipped.some((d) => belongsTo(l.url.hostname, d)))
    );
  },
  run(ctx) {
    const listed = blocklists(ctx).listed || {};
    const links = checkableLinks(ctx);
    return Object.keys(listed)
      .map((domain) => {
        const link = linkOf(links, domain);
        return {
          messageKey:
            'Domain on a blocklist (__lists__), filters may send the email to spam: __domain__',
          params: { domain, lists: listed[domain].join(', ') },
          blockId: link ? link.blockId : null,
          value: domain,
        };
      })
      .concat(
        unchecked(ctx).map((domain) => {
          const link = linkOf(links, domain);
          return {
            severity: 'info',
            messageKey:
              'Domain could not be checked against the blocklists: __domain__',
            params: { domain },
            blockId: link ? link.blockId : null,
            // Ignoring "could not check" must not hide a later listing.
            value: `unchecked|${domain}`,
          };
        })
      );
  },
};
