'use strict';

const bodyParser = require('body-parser');
const createError = require('http-errors');
const config = require('../node.config.js');
const { AIUsageCounters } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { selectedGroupIdOf } = require('../account/request-scope.js');

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// What a single request may carry to a provider. Legitimate payloads (a block,
// the text of a whole email) stay far below.
const AI_MAX_BODY = '256kb';

// The routes that forward a user payload to an AI provider, as the app mounts
// them. Their body is read by aiBodyParser, before the app's own parser, which
// reads up to 50 MB: once a body is read, no later parser reads it again.
const AI_ROUTE_PATHS = [
  '/api/translation/text',
  '/api/translation/block',
  '/api/mailings/:mailingId/duplicate-translate',
  '/api/text-generation',
];

/**
 * The windows a request is counted in. Shared by every AI route: the provider
 * quota they protect is the same.
 */
function windowsFor({ userId, groupId, now, limits }) {
  const minute = now.toISOString().slice(0, 16); // 2026-10-01T09:41
  const day = now.toISOString().slice(0, 10); // 2026-10-01
  const userWindows = [
    {
      key: `user:${userId}:minute:${minute}`,
      max: Number(limits.perUserPerMinute),
      // Kept one window past its end so a request at hh:mm:59.9 still finds it.
      expiresAt: new Date(now.getTime() + 2 * MINUTE_MS),
      retryAfterSeconds: 60 - now.getUTCSeconds(),
    },
    {
      key: `user:${userId}:day:${day}`,
      max: Number(limits.perUserPerDay),
      expiresAt: new Date(now.getTime() + 2 * DAY_MS),
      retryAfterSeconds: secondsToEndOfDay(now),
    },
  ];
  // A super admin with no company selected has no group to count against:
  // only its own windows apply.
  const groupWindows = groupId
    ? [
        {
          key: `group:${groupId}:day:${day}`,
          max: Number(limits.perGroupPerDay),
          expiresAt: new Date(now.getTime() + 2 * DAY_MS),
          retryAfterSeconds: secondsToEndOfDay(now),
        },
      ]
    : [];
  const isSet = (w) => Number.isFinite(w.max) && w.max > 0;
  return {
    userWindows: userWindows.filter(isSet),
    groupWindows: groupWindows.filter(isSet),
  };
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
 * Increments every window at once, and refuses the request if one is exceeded.
 * All of them are incremented, even when one already refuses, so a refused
 * request still counts: hammering never resets a window.
 *
 * @throws {HttpError} 429 AI_RATE_LIMITED, with `retryAfterSeconds`
 */
async function countIn(windows) {
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

/**
 * Count one request against the user's windows, then the group's.
 *
 * A request the user's own ceiling refuses counts against that user only: the
 * group's window is incremented once the user's windows have let it through,
 * so one account in a loop cannot use up its colleagues' day.
 *
 * @throws {HttpError} 429 AI_RATE_LIMITED, with `retryAfterSeconds`
 */
async function consume({ userId, groupId, now = new Date(), limits }) {
  const { userWindows, groupWindows } = windowsFor({
    userId,
    groupId,
    now,
    limits,
  });
  await countIn(userWindows);
  await countIn(groupWindows);
}

/**
 * Reads the body of an AI route as JSON, up to AI_MAX_BODY. An oversized body
 * is refused with the AI routes' own code, before it is read in full. Every
 * content type is read here: a form-encoded body would otherwise fall through
 * to the app's own parsers.
 */
const parseAiBody = bodyParser.json({ limit: AI_MAX_BODY, type: () => true });
function aiBodyParser(req, res, next) {
  parseAiBody(req, res, (err) => {
    if (err && err.type === 'entity.too.large') {
      return next(createError(413, ERROR_CODES.AI_PAYLOAD_TOO_LARGE));
    }
    return next(err);
  });
}

/**
 * Express middleware for the routes that forward a user payload to an AI
 * provider: counts the request against the per-user and per-group windows
 * (429). Its route's path belongs in AI_ROUTE_PATHS, which caps the body size.
 */
function aiRateLimit() {
  return async function aiRateLimitMiddleware(req, res, next) {
    try {
      const { user } = req;
      await consume({
        userId: user.id,
        // The company the request works in: a super admin's selected one.
        groupId: selectedGroupIdOf(user),
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
  aiBodyParser,
  consume,
  AI_MAX_BODY,
  AI_ROUTE_PATHS,
};
