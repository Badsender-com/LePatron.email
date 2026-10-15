'use strict';

// The same function as `clientIp` in utils/rate-limit.js on develop, which
// this branch does not have yet: keep only one of the two when rebasing.

// Private, loopback and link-local addresses: hops inside the platform, never
// a client on the internet.
const INTERNAL_ADDRESS = [
  /^10\./,
  /^127\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^::1$/,
  /^f[cd][0-9a-f]{2}:/i,
  /^fe80:/i,
];
const isInternal = (address) =>
  INTERNAL_ADDRESS.some((pattern) =>
    pattern.test(address.replace(/^::ffff:/i, ''))
  );

// Behind the platform's proxy, `req.ip` is the proxy. Each proxy appends the
// address it saw to the forwarded chain, so the last entry from the internet
// is the client as the platform's edge knows it: internal hops appended after
// it are skipped, and the earlier entries are whatever the client sent and
// are never used as a key. A CDN in front of the platform would make its own
// address the key, and no proxy at all would let the client pick the key:
// such a deployment needs this function revisited.
function clientIp(req) {
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const chain = forwarded
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    for (let i = chain.length - 1; i >= 0; i -= 1) {
      if (!isInternal(chain[i])) return chain[i];
    }
    if (chain.length > 0) return chain[chain.length - 1];
  }
  return req.ip || (req.connection && req.connection.remoteAddress) || null;
}

module.exports = { clientIp };
