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

/**
 * Why a host was refused. Callers map these onto messages an admin can act on:
 * "the address is private" and "the name does not resolve" call for opposite
 * fixes, and collapsing them into one failure leaves nothing to go on.
 */
const OUTBOUND_HOST_ERRORS = Object.freeze({
  INVALID_URL: 'OUTBOUND_HOST_INVALID_URL',
  INVALID_PROTOCOL: 'OUTBOUND_HOST_INVALID_PROTOCOL',
  PRIVATE_ADDRESS: 'OUTBOUND_HOST_PRIVATE_ADDRESS',
  DNS_FAILED: 'OUTBOUND_HOST_DNS_FAILED',
});

function outboundHostError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

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
    throw outboundHostError(
      'Invalid apiHost',
      OUTBOUND_HOST_ERRORS.INVALID_URL
    );
  }

  let parsed;
  try {
    parsed = new URL(apiHost);
  } catch (_) {
    throw outboundHostError(
      'Invalid apiHost URL',
      OUTBOUND_HOST_ERRORS.INVALID_URL
    );
  }

  const allowedProtocols = httpsOnly ? ['https:'] : ['http:', 'https:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw outboundHostError(
      'Invalid protocol',
      OUTBOUND_HOST_ERRORS.INVALID_PROTOCOL
    );
  }

  // URL keeps IPv6 literals in their brackets ("[::1]"), which ipaddr cannot
  // parse — so those used to fall through to the DNS branch and were only
  // refused because the lookup failed, not because they are loopback. Blocked
  // either way in practice, but by accident rather than by the rule.
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  // If the hostname is already a literal IP, classify it directly.
  if (ipaddr.isValid(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw outboundHostError(
        'Host resolves to a disallowed address range',
        OUTBOUND_HOST_ERRORS.PRIVATE_ADDRESS
      );
    }
    return;
  }

  // Otherwise resolve DNS (A + AAAA) and reject if ANY resolved address is
  // blocked — a single internal record is enough to enable SSRF.
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (_) {
    throw outboundHostError(
      'Host DNS resolution failed',
      OUTBOUND_HOST_ERRORS.DNS_FAILED
    );
  }

  if (!addresses || addresses.length === 0) {
    throw outboundHostError(
      'Host did not resolve',
      OUTBOUND_HOST_ERRORS.DNS_FAILED
    );
  }

  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      throw outboundHostError(
        'Host resolves to a disallowed address range',
        OUTBOUND_HOST_ERRORS.PRIVATE_ADDRESS
      );
    }
  }
}

module.exports = {
  assertOutboundHostAllowed,
  OUTBOUND_HOST_ERRORS,
  // exported for testing
  isBlockedAddress,
};
