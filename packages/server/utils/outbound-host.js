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
 * `assertOutboundHostAllowed` alone does not close that window — the request
 * resolves the name again. Outbound calls that carry a secret go through
 * `guardedLookup` (see integration-providers/provider-http.js), which checks
 * the very addresses the socket then connects to.
 */

const dns = require('dns').promises;
// Callback API, read at call time (not destructured) so tests can stub it.
const dnsCallbacks = require('dns');
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

// Set on the error guardedLookup refuses with, so callers can tell a refused
// host from a network failure.
const BLOCKED_HOST_ERROR_CODE = 'EBLOCKEDHOST';

/**
 * `lookup` for the HTTP agents of outbound calls: resolves the name once,
 * refuses it if ANY address is blocked, and hands the socket only addresses it
 * validated.
 *
 * Validating in `assertOutboundHostAllowed` and letting the request resolve
 * again leaves a gap a TTL-0 domain can use to answer a public address to the
 * check and 127.0.0.1 to the request (DNS rebinding). Here the check and the
 * connection share one resolution, so there is no gap.
 *
 * Node calls it for hostnames only — a literal IP never reaches it, which is
 * why `assertOutboundHostAllowed` still runs before each request.
 *
 * Same signature as `dns.lookup`: Node 18 asks for one address, newer versions
 * (autoSelectFamily) ask for `all`.
 */
function guardedLookup(hostname, options, callback) {
  const cb = typeof options === 'function' ? options : callback;
  const opts = typeof options === 'function' || !options ? {} : options;
  const lookupOptions =
    typeof opts === 'number' ? { family: opts } : { ...opts };

  dnsCallbacks.lookup(
    hostname,
    { ...lookupOptions, all: true },
    (err, addresses) => {
      if (err) return cb(err);
      if (!addresses || addresses.length === 0) {
        const notFound = new Error(`Host did not resolve: ${hostname}`);
        notFound.code = 'ENOTFOUND';
        return cb(notFound);
      }
      if (addresses.some(({ address }) => isBlockedAddress(address))) {
        const blocked = new Error(
          'Host resolves to a disallowed address range'
        );
        blocked.code = BLOCKED_HOST_ERROR_CODE;
        return cb(blocked);
      }
      if (lookupOptions.all) return cb(null, addresses);
      return cb(null, addresses[0].address, addresses[0].family);
    }
  );
}

module.exports = {
  assertOutboundHostAllowed,
  OUTBOUND_HOST_ERRORS,
  guardedLookup,
  BLOCKED_HOST_ERROR_CODE,
  // exported for testing
  isBlockedAddress,
};
