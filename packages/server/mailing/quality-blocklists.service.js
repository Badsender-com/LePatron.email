'use strict';

const dns = require('dns');
const psl = require('psl');

const config = require('../node.config.js');

/**
 * DNS blocklists of domains (Spamhaus DBL, SURBL, URIBL, Invaluement…), for
 * the quality check on the domains an email links to. A listed domain is asked
 * as `<domain>.<zone>`: an address in 127.0.0.0/8 means listed, no answer
 * means not listed.
 */

const DNS_TIMEOUT_MS = 2000;

/**
 * The blocklists to query, from `QC_DOMAIN_BLOCKLISTS`:
 * "Spamhaus DBL=<key>.dbl.dq.spamhaus.net,SURBL=multi.surbl.org".
 * None by default: every one of them asks for a subscription for commercial
 * use, and Spamhaus answers nothing through public resolvers.
 */
function blocklistZones(
  value = config.qualityControl && config.qualityControl.domainBlocklists
) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const at = entry.indexOf('=');
      return at > 0
        ? { name: entry.slice(0, at).trim(), zone: entry.slice(at + 1).trim() }
        : { name: entry, zone: entry };
    })
    .filter(({ zone }) => /^[a-z0-9.-]+$/i.test(zone));
}

// 127.0.0.1 is how URIBL and SURBL refuse a query, 127.255.255.x how Spamhaus
// does: neither says anything about the domain.
function isListing(address) {
  return (
    /^127\./.test(address) &&
    address !== '127.0.0.1' &&
    !/^127\.255\.255\./.test(address)
  );
}

function resolve4(name) {
  const resolver = new dns.promises.Resolver({
    timeout: DNS_TIMEOUT_MS,
    tries: 1,
  });
  return resolver.resolve4(name);
}

/**
 * @returns {Promise<string[]>} the names of the blocklists listing `domain`
 */
async function listedOn(domain, zones, lookup = resolve4) {
  const names = await Promise.all(
    zones.map(async ({ name, zone }) => {
      try {
        const addresses = await lookup(`${domain}.${zone}`);
        return addresses.some(isListing) ? name : null;
      } catch (e) {
        // NXDOMAIN is the normal answer: not listed.
        return null;
      }
    })
  );
  return names.filter(Boolean);
}

// What the blocklists list: the registrable domain (brand.co.uk), not the host.
function registrableDomain(url) {
  try {
    return psl.get(new URL(url).hostname);
  } catch (e) {
    return null;
  }
}

module.exports = {
  blocklistZones,
  isListing,
  listedOn,
  registrableDomain,
  resolve4,
};
