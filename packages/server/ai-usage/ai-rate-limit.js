'use strict';

const createError = require('http-errors');
const config = require('../node.config.js');
const { AIUsageCounters } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// What a single request may carry to a provider. Legitimate payloads — a block,
// the text of a whole email — stay far below; the global 50 MB body limit of
// the app is what this replaces on AI routes.
const DEFAULT_MAX_BODY_BYTES = 256 * 1024;

/**
 * The windows a request is counted in. Shared by every AI route: the provider
 * quota they protect is the same.
 */
function windowsFor({ userId, groupId, now, limits }) {
  const minute = now.toISOString().slice(0, 16); // 2026-10-01T09:41
  const day = now.toISOString().slice(0, 10); // 2026-10-01
  const windows = [
    {
      key: `user:${userId}:minute:${minute}`,
      max: limits.perUserPerMinute,
      // Kept one window past its end so a request at hh:mm:59.9 still finds it.
      expiresAt: new Date(now.getTime() + 2 * MINUTE_MS),
      retryAfterSeconds: 60 - now.getUTCSeconds(),
    },
    {
      key: `user:${userId}:day:${day}`,
      max: limits.perUserPerDay,
      expiresAt: new Date(now.getTime() + 2 * DAY_MS),
      retryAfterSeconds: secondsToEndOfDay(now),
    },
  ];
  // The super-admin pseudo-user has no group: only its own windows apply.
  if (groupId) {
    windows.push({
      key: `group:${groupId}:day:${day}`,
      max: limits.perGroupPerDay,
      expiresAt: new Date(now.getTime() + 2 * DAY_MS),
      retryAfterSeconds: secondsToEndOfDay(now),
    });
  }
  return windows.filter((w) => Number.isFinite(w.max) && w.max > 0);
}

function secondsToEndOfDay(now) {
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  );
  return Math.ceil((end - now.getTime()) / 1000);
}

/**
 * Count one request against every window, and refuse it if one is exceeded.
 *
 * Every window is incremented, even when an earlier one already refuses: the
 * order of the writes would otherwise decide which counters a hammering client
 * still feeds. A refused request therefore counts — which is what makes
 * hammering useless.
 *
 * @throws {HttpError} 429 AI_RATE_LIMITED, with `retryAfterSeconds`
 */
async function consume({ userId, groupId, now = new Date(), limits }) {
  const windows = windowsFor({ userId, groupId, now, limits });
  const counters = await Promise.all(
    windows.map((w) =>
      AIUsageCounters.findOneAndUpdate(
        { key: w.key },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: w.expiresAt } },
        { upsert: true, new: true, projection: { count: 1 } }
      ).lean()
    )
  );
  const exceeded = windows.filter((w, i) => counters[i].count > w.max);
  if (exceeded.length) {
    const err = createError(429, ERROR_CODES.AI_RATE_LIMITED);
    err.retryAfterSeconds = Math.max(
      ...exceeded.map((w) => w.retryAfterSeconds)
    );
    throw err;
  }
}

function bodyBytes(body) {
  if (body === undefined || body === null) return 0;
  return Buffer.byteLength(JSON.stringify(body), 'utf8');
}

/**
 * Express middleware for the routes that forward a user payload to an AI
 * provider: refuses an oversized payload (413), then counts the request
 * against the per-user and per-group windows (429).
 *
 * @param {Object} [options]
 * @param {number} [options.maxBodyBytes]
 */
function aiRateLimit({ maxBodyBytes = DEFAULT_MAX_BODY_BYTES } = {}) {
  return async function aiRateLimitMiddleware(req, res, next) {
    try {
      // Checked before counting: an oversized payload costs the provider
      // nothing, since it never reaches it.
      if (bodyBytes(req.body) > maxBodyBytes) {
        throw createError(413, ERROR_CODES.AI_PAYLOAD_TOO_LARGE);
      }
      const { user } = req;
      await consume({
        userId: user.id,
        groupId: user.group && user.group.id,
        limits: config.aiRateLimits || {},
      });
      next();
    } catch (err) {
      if (err.retryAfterSeconds) {
        res.set('Retry-After', String(err.retryAfterSeconds));
      }
      next(err);
    }
  };
}

module.exports = {
  aiRateLimit,
  consume,
  DEFAULT_MAX_BODY_BYTES,
};
