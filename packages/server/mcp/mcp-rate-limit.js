'use strict';

const {
  ProtocolError,
  ProtocolErrorCode,
} = require('@modelcontextprotocol/server');

// The rate limit of the MCP server (ADR 0012), counted per minute.

const WINDOW_MS = 60 * 1000;
// A connection is one user, in one company, from one connected application: a
// minute of steady work for an assistant. A company shares five times that.
const LIMITS = { connection: 60, group: 300 };
const SCOPES = {
  connection: 'for this connection',
  group: 'for the whole company',
};

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
 * Counts a call against its connection and its company, or refuses it when
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
    `Rate limit reached: LePatron answers about ${LIMITS[scope]} calls a minute ${SCOPES[scope]}. Retry in ${seconds} seconds.`,
    { retryAfterSeconds: seconds }
  );
}

module.exports = { admit, refusalOf, clock, forgetCounts };
