'use strict';

const { z } = require('zod');
const {
  ProtocolError,
  ProtocolErrorCode,
} = require('@modelcontextprotocol/server');
const { McpCallLogs, Groups } = require('../common/models.common.js');
const {
  computeExpiresAt,
} = require('../ai-skill/services/invocation-logger.service.js');
const logger = require('../utils/logger.js');
const { isObjectIdString } = require('../utils/model.js');

const WINDOW_MS = 60 * 1000;
// A connection is one user, in one company, from one connected application: a
// minute of steady work for an assistant. A company shares five times that.
const LIMITS = { connection: 60, group: 300 };
const SCOPES = {
  connection: 'for this connection',
  group: 'for the whole company',
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

// What the log keeps of what was asked: ids, never the rest of what was
// typed, each bounded, and a few of them.
const ID_KEY = /^(id|uri)$|Ids?$/;
const MAX_IDS = 20;
const MAX_ID_LENGTH = 200;
const MAX_NAME_LENGTH = 500;
// How deep, and over how many values, the arguments are read for their ids.
const MAX_DEPTH = 4;
const MAX_VISITS = 1000;

const cut = (value, max) =>
  typeof value === 'string' ? value.slice(0, max) : null;

/**
 * The ids a tool declares, read from its input schema: an argument whose name
 * says it is an id (`id`, `uri`, `…Id`, `…Ids`), a string or a list of
 * strings, at any depth.
 *
 * @param {Object} schema the JSON schema of the tool's input
 * @returns {Object|true|null} the paths of its ids, as a tree whose leaves
 *   are `true`; null when it declares none
 */
function idPathsOf(schema, depth = 0) {
  if (!schema || depth > MAX_DEPTH) return null;
  if (schema.type === 'array') return idPathsOf(schema.items, depth + 1);
  if (schema.type !== 'object' || !schema.properties) return null;
  const tree = {};
  Object.entries(schema.properties).forEach(([name, property]) => {
    const item = property.type === 'array' ? property.items : property;
    if (ID_KEY.test(name) && item && item.type === 'string') {
      tree[name] = true;
      return;
    }
    const nested = idPathsOf(property, depth + 1);
    if (nested) tree[name] = nested;
  });
  return Object.keys(tree).length ? tree : null;
}

function declaredIdsOf(inputSchema) {
  if (!inputSchema) return null;
  try {
    return idPathsOf(z.toJSONSchema(inputSchema, { io: 'input' }));
  } catch (err) {
    // A schema JSON cannot describe declares no id the log could keep.
    return null;
  }
}

// The ids found along the declared paths, until MAX_IDS of them, reading at
// most MAX_VISITS values: what was typed beside them is never read.
function idsAlong(value, paths) {
  const ids = [];
  let visits = 0;
  const walk = (node, tree, depth) => {
    visits += 1;
    if (ids.length >= MAX_IDS || visits > MAX_VISITS || depth > MAX_DEPTH) {
      return;
    }
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        if (ids.length >= MAX_IDS || visits > MAX_VISITS) return;
        walk(item, tree, depth + 1);
      }
      return;
    }
    if (tree === true) {
      if (typeof node === 'string') ids.push(cut(node, MAX_ID_LENGTH));
      return;
    }
    if (typeof node !== 'object') return;
    Object.entries(tree).forEach(([name, subtree]) =>
      walk(node[name], subtree, depth + 1)
    );
  };
  if (paths) walk(value, paths, 0);
  return ids;
}

// What a call asked for, as the log keeps it: the tool or the prompt, and the
// ids it was given, those its tool declares only.
function whatWasAsked(method, params = {}, declared) {
  const name = cut(params.name, MAX_NAME_LENGTH);
  if (method === 'tools/call') {
    return {
      name,
      objectIds: idsAlong(params.arguments, declared.get(params.name)),
    };
  }
  if (method === 'prompts/get') return { name, objectIds: [] };
  if (method === 'resources/read') {
    const uri = cut(params.uri, MAX_NAME_LENGTH);
    return { objectIds: uri ? [uri] : [] };
  }
  return { objectIds: [] };
}

async function record(entry) {
  try {
    const group =
      entry._company &&
      (await Groups.findById(entry._company).select('logRetentionDays').lean());
    await McpCallLogs.create({
      ...entry,
      objectIds: entry.objectIds.filter(Boolean),
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
function guarded(method, handler, declared) {
  return async (request, ctx) => {
    const authInfo = ctx?.http?.authInfo || {};
    // Ids as the server wrote them in the token, checked as such before any
    // query, as withIdentity does: anything else counts and logs as none.
    const { extra = {} } = authInfo;
    const userId = isObjectIdString(extra.userId) ? extra.userId : null;
    const groupId = isObjectIdString(extra.groupId) ? extra.groupId : null;
    const clientId = cut(authInfo.clientId, MAX_NAME_LENGTH) || '';

    // Counted before anything of the request is read.
    const refused = admit({ userId, groupId, clientId });
    const entry = {
      _user: userId,
      _company: groupId,
      clientId,
      method,
      ...whatWasAsked(method, request.params, declared),
    };
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
 * this; the handshake is registered before and stays out. The tools
 * registered from now on say which of their arguments are ids.
 *
 * @param {import('@modelcontextprotocol/server').McpServer} server
 */
function guardCalls(server) {
  // The ids each tool declares, as it is registered: the log keeps those.
  const declared = new Map();
  const register = server.registerTool.bind(server);
  // eslint-disable-next-line no-param-reassign
  server.registerTool = (name, config, callback) => {
    declared.set(name, declaredIdsOf(config && config.inputSchema));
    return register(name, config, callback);
  };

  const inner = server.server;
  const wrap = inner._wrapHandler.bind(inner);
  inner._wrapHandler = (method, handler) =>
    wrap(
      method,
      GUARDED_METHODS.test(method)
        ? guarded(method, handler, declared)
        : handler
    );
}

module.exports = { guardCalls, clock, forgetCounts };
