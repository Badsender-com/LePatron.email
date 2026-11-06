'use strict';

const {
  ProtocolError,
  ProtocolErrorCode,
} = require('@modelcontextprotocol/server');

// The rate limit of the MCP server (ADR 0012), counted per minute.

const WINDOW_MS = 60 * 1000;
// A connection is one user, in one company, from one connected application: a
// minute of steady work for an assistant. A user has twice that across the
// applications they connect, which anyone may register; a company shares five
// times that.
const LIMITS = { connection: 60, user: 120, group: 300 };
const SCOPES = {
  connection: 'for this connection',
  user: 'for this account, across its connected applications',
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

// Counts a call in each of the windows, or refuses it when one of them
// already reached its limit this minute.
function admitIn(keys) {
  const now = clock.now();
  if (windows.size > 10000) forgetEndedWindows(now);
  const counted = Object.entries(keys).map(([scope, key]) => [
    scope,
    windowOf(key, now),
  ]);
  const full = counted.find(([scope, window]) => window.count >= LIMITS[scope]);
  if (!full) {
    counted.forEach(([, window]) => {
      window.count += 1;
    });
    return null;
  }
  const [scope, window] = full;
  const firstRefusal = !window.refusalLogged;
  window.refusalLogged = true;
  return { scope, retryInMs: window.start + WINDOW_MS - now, firstRefusal };
}

/**
 * Counts a call against who makes it, from what the token says, before
 * anything is read: its connection, and its user across their connected
 * applications.
 *
 * @returns {null|{ scope: string, retryInMs: number, firstRefusal: boolean }}
 *   the refusal, when the call is over a limit
 */
function admitCaller({ userId, groupId, clientId }) {
  return admitIn({
    connection: `connection:${userId}:${groupId}:${clientId}`,
    user: `user:${userId}`,
  });
}

/**
 * Counts a call against its company, once who makes it is known to be one of
 * its members still: a token that no longer opens anything costs it nothing.
 *
 * @returns {null|{ scope: string, retryInMs: number, firstRefusal: boolean }}
 */
function admitCompany(groupId) {
  return admitIn({ group: `group:${groupId}` });
}

function refusalOf({ scope, retryInMs }) {
  const seconds = Math.max(1, Math.ceil(retryInMs / 1000));
  return new ProtocolError(
    ProtocolErrorCode.InvalidRequest,
    `Rate limit reached: LePatron answers about ${LIMITS[scope]} calls a minute ${SCOPES[scope]}. Retry in ${seconds} seconds.`,
    { retryAfterSeconds: seconds }
  );
}

module.exports = {
  admitCaller,
  admitCompany,
  refusalOf,
  clock,
  forgetCounts,
  LIMITS,
};
