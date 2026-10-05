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
 * @param {Function} [options.now] clock, for tests
 * @returns {Function} an express middleware answering 429 past the limit
 */
function createRateLimiter({ windowMs, max, keyOf, now = Date.now }) {
  const windows = new Map();

  function prune(at) {
    for (const [key, entry] of windows) {
      if (entry.resetAt <= at) windows.delete(key);
    }
  }

  return function rateLimit(req, res, next) {
    const key = keyOf(req);
    if (!key) return next();
    const at = now();
    if (windows.size > 1000) prune(at);

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
    next();
  };
}

// Behind the platform's proxy, `req.ip` is the proxy. The proxy appends the
// address it saw to the forwarded chain, so the last entry is the client as
// the proxy knows it; the earlier entries are whatever the client sent and
// are never used as a key.
function clientIp(req) {
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    const chain = forwarded.split(',').map((entry) => entry.trim());
    return chain[chain.length - 1];
  }
  return req.ip || (req.connection && req.connection.remoteAddress) || null;
}

module.exports = { createRateLimiter, clientIp };
