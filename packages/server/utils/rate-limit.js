'use strict';

const createError = require('http-errors');

/**
 * A fixed-window rate limiter, in memory and per process. Enough to keep a
 * public endpoint from being hammered from one address or on one account; not
 * a shared counter across instances (each instance has its own window, like
 * the playground budget in ai-playground/services/test-budget.service.js).
 *
 * @param {Object} options
 * @param {number} options.windowMs length of the window
 * @param {number} options.max calls allowed per key and per window
 * @param {Function} options.keyOf the key of a request, or a falsy value to
 *   skip the limit for it
 * @param {boolean} [options.refundSuccess] give the call back once it
 *   answers below 400, so only the failed calls use the budget (a sign-in
 *   that works never locks out the colleagues behind the same address). The
 *   call counts while it runs, so parallel attempts cannot overtake the limit.
 * @param {Function} [options.now] clock, for tests
 * @returns {Function} an express middleware answering 429 past the limit
 */
function createRateLimiter({
  windowMs,
  max,
  keyOf,
  refundSuccess = false,
  now = Date.now,
  maxEntries = 10000,
}) {
  const windows = new Map();

  // Keys come from requests, so the store is bounded: expired windows go
  // first, then the oldest ones still under their limit (a Map keeps
  // insertion order), so that filling the store with new keys does not clear
  // the counter of a key that reached it. Only a store full of exhausted
  // windows drops those, oldest first.
  function prune(at) {
    for (const [key, entry] of windows) {
      if (entry.resetAt <= at) windows.delete(key);
    }
    for (const [key, entry] of windows) {
      if (windows.size < maxEntries) return;
      if (entry.count < max) windows.delete(key);
    }
    for (const key of windows.keys()) {
      if (windows.size < maxEntries) return;
      windows.delete(key);
    }
  }

  return function rateLimit(req, res, next) {
    const key = keyOf(req);
    if (!key) return next();
    const at = now();
    if (windows.size >= maxEntries) prune(at);

    let entry = windows.get(key);
    if (!entry || entry.resetAt <= at) {
      entry = { count: 0, resetAt: at + windowMs };
      windows.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - at) / 1000)));
      return next(new createError.TooManyRequests());
    }
    if (refundSuccess) {
      res.on('finish', () => {
        if (res.statusCode < 400 && entry.count > 0) entry.count -= 1;
      });
    }
    next();
  };
}

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

module.exports = { createRateLimiter, clientIp };
