'use strict';

/**
 * SSRF guard for user-controlled outbound hosts.
 *
 * Integration `apiHost` values are configured by group admins and become the
 * target of server-side requests:
 *   - openai-provider fetches `${apiHost}/v1/models` with `Bearer ${apiKey}`
 *     (leaks the API key to whatever host the admin picks),
 *   - crm-intelligence builds a Metabase embed URL from `apiHost` carrying a
 *     signed JWT (leaks the token).
 * A bare scheme check lets an admin point apiHost at `169.254.169.254` (cloud
 * metadata) or any internal service. This module resolves the host's DNS and
 * rejects any address that maps to a private / loopback / link-local / etc.
 * range, for both IPv4 and IPv6 (including IPv4-mapped IPv6).
 *
 * Note on TOCTOU: DNS can change between validation and the actual request.
 * Re-run `assertOutboundHostAllowed` immediately before the outbound call (the
 * resolution cost is small), or layer an explicit host allowlist on top.
 */

const dns = require('dns').promises;
const ipaddr = require('ipaddr.js');

// IPv4/IPv6 range names (from ipaddr.js `.range()`) that must never be the
// target of a server-side request. Anything not in the public unicast space.
const BLOCKED_RANGES = new Set([
  'unspecified', // 0.0.0.0, ::
  'broadcast', // 255.255.255.255
  'multicast',
  'linkLocal', // 169.254.0.0/16, fe80::/10 (covers cloud metadata 169.254.169.254)
  'loopback', // 127.0.0.0/8, ::1
  'carrierGradeNat', // 100.64.0.0/10
  'private', // 10/8, 172.16/12, 192.168/16
  'reserved',
  'uniqueLocal', // fc00::/7
  'ipv4Mapped',
  'rfc6145',
  'rfc6052',
  '6to4',
  'teredo',
]);

/**
 * @param {string} hostname
 * @returns {boolean} true if the resolved address falls in a blocked range
 */
function isBlockedAddress(address) {
  let parsed;
  try {
    parsed = ipaddr.parse(address);
  } catch (_) {
    // Unparseable address — fail closed.
    return true;
  }
  // Unwrap IPv4-mapped IPv6 (e.g. ::ffff:169.254.169.254) so the underlying
  // IPv4 range is what gets classified, not the wrapper.
  if (parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress()) {
    parsed = parsed.toIPv4Address();
  }
  return BLOCKED_RANGES.has(parsed.range());
}

/**
 * Validate that `apiHost` is a well-formed URL whose scheme is allowed and
 * whose DNS resolution does not point at an internal/private address.
 *
 * @param {string} apiHost
 * @param {Object} [options]
 * @param {boolean} [options.httpsOnly=false] require https (used by CRM embed)
 * @returns {Promise<void>} resolves if allowed; rejects (throws) otherwise
 */
async function assertOutboundHostAllowed(apiHost, options = {}) {
  const { httpsOnly = false } = options;

  if (!apiHost || typeof apiHost !== 'string') {
    throw new Error('Invalid apiHost');
  }

  let parsed;
  try {
    parsed = new URL(apiHost);
  } catch (_) {
    throw new Error('Invalid apiHost URL');
  }

  const allowedProtocols = httpsOnly ? ['https:'] : ['http:', 'https:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new Error('Invalid protocol');
  }

  const hostname = parsed.hostname;

  // If the hostname is already a literal IP, classify it directly.
  if (ipaddr.isValid(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new Error('Host resolves to a disallowed address range');
    }
    return;
  }

  // Otherwise resolve DNS (A + AAAA) and reject if ANY resolved address is
  // blocked — a single internal record is enough to enable SSRF.
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (_) {
    throw new Error('Host DNS resolution failed');
  }

  if (!addresses || addresses.length === 0) {
    throw new Error('Host did not resolve');
  }

  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      throw new Error('Host resolves to a disallowed address range');
    }
  }
}

module.exports = {
  assertOutboundHostAllowed,
  // exported for testing
  isBlockedAddress,
};
