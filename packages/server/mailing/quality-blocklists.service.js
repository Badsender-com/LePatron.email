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
const isRefusal = (address) =>
  address === '127.0.0.1' || /^127\.255\.255\./.test(address);

function isListing(address) {
  return /^127\./.test(address) && !isRefusal(address);
}

// The resolver's answers for a name the zone does not list.
const NOT_LISTED = new Set(['ENOTFOUND', 'ENODATA']);

async function askZone(domain, { name, zone }, lookup) {
  try {
    const addresses = await lookup(`${domain}.${zone}`);
    if (addresses.some(isListing)) return { name, listed: true };
    // A refusal, or an answer outside 127/8: the zone said nothing.
    return { name, listed: false, failed: addresses.length > 0 };
  } catch (error) {
    if (NOT_LISTED.has(error.code)) return { name, listed: false };
    // A timeout, a resolver down, SERVFAIL: not "not listed".
    return { name, listed: false, failed: true };
  }
}

// One resolver for the process: its sockets are reused across queries.
const resolver = new dns.promises.Resolver({
  timeout: DNS_TIMEOUT_MS,
  tries: 1,
});

const resolve4 = (name) => resolver.resolve4(name);

/**
 * @returns {Promise<{ names: string[], checked: boolean }>} the names of the
 *   blocklists listing `domain`; `checked` is false when a zone could not
 *   answer, so that "listed by none" is not taken for "clean"
 */
async function listedOn(domain, zones, lookup = resolve4) {
  const answers = await Promise.all(
    zones.map((entry) => askZone(domain, entry, lookup))
  );
  return {
    names: answers.filter((answer) => answer.listed).map(({ name }) => name),
    checked: answers.every((answer) => !answer.failed),
  };
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
