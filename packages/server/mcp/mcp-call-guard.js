'use strict';

const { McpCallLogs, Groups } = require('../common/models.common.js');
const {
  computeExpiresAt,
} = require('../ai-skill/services/invocation-logger.service.js');
const logger = require('../utils/logger.js');
const { isObjectIdString } = require('../utils/model.js');
const { admit, refusalOf } = require('./mcp-rate-limit.js');
const {
  declaredIdsOf,
  whatWasAsked,
  cut,
  MAX_NAME_LENGTH,
} = require('./mcp-call-ids.js');

// What is counted and logged: what a connected application asks of LePatron,
// not the handshake.
const GUARDED_METHODS = /^(tools|resources|prompts|completion)\//;

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

module.exports = { guardCalls };
