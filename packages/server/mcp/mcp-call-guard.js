'use strict';

const { ProtocolError } = require('@modelcontextprotocol/server');
const { isObjectIdString } = require('../utils/model.js');
const { admitCaller, admitCompany, refusalOf } = require('./mcp-rate-limit.js');
const { identify } = require('./mcp-identity.js');
const { recordCall } = require('./mcp-call-log.js');
const {
  declaredIdsOf,
  whatWasAsked,
  cut,
  MAX_NAME_LENGTH,
} = require('./mcp-call-ids.js');

// What is counted and logged: what a connected application asks of LePatron,
// not the handshake.
const GUARDED_METHODS = /^(tools|resources|prompts|completion)\//;

// How a call ended: a tool reports its failure in its result, any other
// handler throws it. A call whose caller was refused ended in that refusal.
function outcomeOf(failed, refusal) {
  if (!failed) return 'ok';
  return refusal instanceof ProtocolError ? 'refused' : 'error';
}

/**
 * A request handler, counted against the rate limit and logged (ADR 0012).
 * Who calls is resolved once, here, for the handler too (`identify`): the
 * call counts against the company once its caller is known to be one of its
 * members still. The log keeps metadata only: who, from which application,
 * what was asked by its ids, how long it took and how it ended.
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
    const overCaller = admitCaller({ userId, groupId, clientId });
    const entry = {
      _user: userId,
      _company: groupId,
      clientId,
      method,
      ...whatWasAsked(method, request.params, declared),
    };
    const { identity, refusal } = overCaller ? {} : await identify(ctx);
    const over = overCaller || (refusal ? null : admitCompany(groupId));
    if (over) {
      if (over.firstRefusal) {
        recordCall({ ...entry, durationMs: 0, outcome: 'rate_limited' });
      }
      throw refusalOf(over);
    }

    // The static listings answer anyone; a handler that reads data throws
    // the refusal `identify` kept for it (withIdentity).
    const startedAt = Date.now();
    let failed = true;
    try {
      const result = await handler(request, ctx);
      failed = Boolean(result?.isError);
      return result;
    } finally {
      // Written in the background: the answer does not wait for its log.
      recordCall(
        {
          ...entry,
          durationMs: Date.now() - startedAt,
          outcome: outcomeOf(failed, refusal),
        },
        identity
      );
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
