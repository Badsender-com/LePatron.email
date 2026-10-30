'use strict';

const {
  ProtocolError,
  ProtocolErrorCode,
} = require('@modelcontextprotocol/server');
const { McpCallLogs, Groups } = require('../common/models.common.js');
const {
  computeExpiresAt,
} = require('../ai-skill/services/invocation-logger.service.js');
const logger = require('../utils/logger.js');

const WINDOW_MS = 60 * 1000;
// A connection is one user, in one group, from one connected application: a
// minute of steady work for an assistant. A group shares five times that.
const LIMITS = { connection: 60, group: 300 };
const SCOPES = {
  connection: 'for this connection',
  group: 'for the whole group',
};

// What is counted and logged: what a connected application asks of LePatron,
// not the handshake.
const GUARDED_METHODS = /^(tools|resources|prompts|completion)\//;

// The time the windows are counted in; the tests move it forward.
const clock = { now: Date.now };

// Counted in memory, per process: a guard against a runaway assistant, not a
// quota to bill.
const windows = new Map();

function forgetCounts() {
  windows.clear();
}

function forgetEndedWindows(now) {
  windows.forEach((window, key) => {
    if (now - window.start >= WINDOW_MS) windows.delete(key);
  });
}

function windowOf(key, now) {
  const current = windows.get(key);
  if (current && now - current.start < WINDOW_MS) return current;
  const fresh = { start: now, count: 0, refusalLogged: false };
  windows.set(key, fresh);
  return fresh;
}

/**
 * Counts a call against its connection and its group, or refuses it when
 * either already reached its limit this minute.
 *
 * @returns {null|{ scope: string, retryInMs: number, firstRefusal: boolean }}
 */
function admit({ userId, groupId, clientId }) {
  const now = clock.now();
  if (windows.size > 10000) forgetEndedWindows(now);
  const counted = {
    connection: windowOf(`connection:${userId}:${groupId}:${clientId}`, now),
    group: windowOf(`group:${groupId}`, now),
  };
  const full = Object.keys(LIMITS).find(
    (scope) => counted[scope].count >= LIMITS[scope]
  );
  if (!full) {
    counted.connection.count += 1;
    counted.group.count += 1;
    return null;
  }
  const window = counted[full];
  const firstRefusal = !window.refusalLogged;
  window.refusalLogged = true;
  return {
    scope: full,
    retryInMs: window.start + WINDOW_MS - now,
    firstRefusal,
  };
}

function refusalOf({ scope, retryInMs }) {
  const seconds = Math.max(1, Math.ceil(retryInMs / 1000));
  return new ProtocolError(
    ProtocolErrorCode.InvalidRequest,
    `Rate limit reached: LePatron answers ${LIMITS[scope]} calls a minute ${SCOPES[scope]}. Retry in ${seconds} seconds.`,
    { retryAfterSeconds: seconds }
  );
}

const ID_KEY = /^(id|uri)$|Ids?$/;

// The ids a call was given, never the rest of what was typed: an argument
// counts when its name says it is an id.
function idsIn(value, key = '', depth = 0) {
  if (depth > 4 || value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => idsIn(item, key, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([name, item]) =>
      idsIn(item, name, depth + 1)
    );
  }
  return ID_KEY.test(key) && typeof value === 'string' ? [value] : [];
}

function whatWasAsked(method, params = {}) {
  if (method === 'tools/call') {
    return { name: params.name, objectIds: idsIn(params.arguments) };
  }
  if (method === 'prompts/get') return { name: params.name, objectIds: [] };
  if (method === 'resources/read') return { objectIds: [params.uri] };
  return { objectIds: [] };
}

async function record(entry) {
  try {
    const group = await Groups.findById(entry._company)
      .select('logRetentionDays')
      .lean();
    await McpCallLogs.create({
      ...entry,
      objectIds: entry.objectIds.filter(Boolean).slice(0, 20),
      expiresAt: computeExpiresAt(new Date(), group?.logRetentionDays),
    });
  } catch (err) {
    logger.error('[mcp] the call could not be logged', err.message);
  }
}

/**
 * A request handler, counted against the rate limit and logged (ADR 0012).
 * The log keeps metadata only: who, from which application, what was asked
 * by its ids, how long it took and how it ended.
 */
function guarded(method, handler) {
  return async (request, ctx) => {
    const authInfo = ctx?.http?.authInfo || {};
    const { userId = null, groupId = null } = authInfo.extra || {};
    const clientId = authInfo.clientId || '';
    const entry = {
      _user: userId,
      _company: groupId,
      clientId,
      method,
      ...whatWasAsked(method, request.params),
    };

    const refused = admit({ userId, groupId, clientId });
    if (refused) {
      if (refused.firstRefusal) {
        await record({ ...entry, durationMs: 0, outcome: 'rate_limited' });
      }
      throw refusalOf(refused);
    }

    const startedAt = Date.now();
    let outcome = 'error';
    try {
      const result = await handler(request, ctx);
      outcome = result?.isError ? 'error' : 'ok';
      return result;
    } finally {
      await record({ ...entry, durationMs: Date.now() - startedAt, outcome });
    }
  };
}

/**
 * Guards every handler the server registers from now on. The SDK pinned in
 * package.json wraps each registered handler with `_wrapHandler`, its hook for
 * this; the handshake is registered before and stays out.
 *
 * @param {import('@modelcontextprotocol/server').McpServer} server
 */
function guardCalls(server) {
  const inner = server.server;
  const wrap = inner._wrapHandler.bind(inner);
  inner._wrapHandler = (method, handler) =>
    wrap(
      method,
      GUARDED_METHODS.test(method) ? guarded(method, handler) : handler
    );
}

module.exports = { guardCalls, clock, forgetCounts };
