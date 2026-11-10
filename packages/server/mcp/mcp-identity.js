'use strict';

const {
  ProtocolError,
  ProtocolErrorCode,
} = require('@modelcontextprotocol/server');
const { Users, Groups } = require('../common/models.common.js');
const logger = require('../utils/logger.js');
const ERROR_CODES = require('../constant/error-codes.js');
const permissions = require('../account/permissions.js');
const { isObjectIdString } = require('../utils/model.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const { isDraftsModeOn } = require('./mcp-connections.js');

// What a user consents to on the consent screen: reading, for everyone (ADR
// 0012), and drafting skills and expertises, offered to who may manage the
// platform (ADR 0014).
const READ_SCOPE = 'mcp:read';
const WRITE_SCOPE = 'skills:write';
const SCOPES = Object.freeze([READ_SCOPE, WRITE_SCOPE]);

/**
 * Whether a token was granted a scope. It only records what the user
 * consented to: what they may do is asked of the permissions module.
 *
 * @param {Object} [authInfo] the validated access token
 * @param {string} scope
 * @returns {boolean}
 */
function hasScope(authInfo, scope) {
  return (authInfo?.scopes || []).includes(scope);
}

/**
 * Whether who calls may write skills and expertises, asked again on every
 * call, whatever the token says: the token was granted the write scope, the
 * user may still manage the platform (ADR 0014), and the connection is to
 * the platform company, the one the work is done for (ADR 0019). Citing a
 * retex in a draft is such a write (ADR 0021).
 *
 * @param {Object} user the request user
 * @param {Object} [group] the company the token is bound to, with `isPlatform`
 * @param {Object} [authInfo] the validated access token
 * @returns {boolean}
 */
function mayWrite(user, group, authInfo) {
  return (
    hasScope(authInfo, WRITE_SCOPE) &&
    permissions.can(user, CAPABILITIES.PLATFORM_MANAGE) &&
    group?.isPlatform === true
  );
}

/**
 * Whether who calls is a consultant of the platform company: a super admin,
 * who may manage the platform, asked again on every call. A consultant reads,
 * dismisses and matches the retex of every company, whatever company they
 * connected to and whatever scopes the token holds (ADR 0021): reading them
 * writes no skill.
 *
 * @param {Object} [user] the request user
 * @returns {boolean}
 */
function isConsultant(user) {
  return Boolean(user) && permissions.can(user, CAPABILITIES.PLATFORM_MANAGE);
}

// What the request user may carry: never a password or a token.
const USER_FIELDS = '_id name email lang role _company isDeactivated';
// What the handlers read of the company: never its secrets. Whether it
// allows retex, and how long its logs are kept, for a feedback. The rights on
// its mailings are the search's, which reads what it needs itself.
const GROUP_FIELDS =
  '_id enableMcpModule enableMcp isPlatform allowRetex logRetentionDays';

const NO_ACCOUNT = 'This account can no longer use LePatron.';
const NO_COMPANY = 'This connection is not bound to a company of this account.';
const NO_MCP_MODULE = 'This company has no MCP module.';
const NO_MCP_ACCESS = 'This company has no MCP access to LePatron.';
const FAILED = 'LePatron could not answer this request. Try again later.';

function refuse(message) {
  throw new ProtocolError(ProtocolErrorCode.InvalidRequest, message);
}

// The MCP error of a request the services refuse (`http-errors`), by status:
// what was asked for is wrong or missing, which MCP answers as invalid
// params (a resource not found too, as the SDK sends it); any other client
// error is an invalid request.
const CLIENT_ERRORS = Object.freeze({
  400: ProtocolErrorCode.InvalidParams,
  404: ProtocolErrorCode.InvalidParams,
  422: ProtocolErrorCode.InvalidParams,
});

/**
 * Whether a service refused a request with a message meant to be shown: an
 * `http-errors` 4xx with `expose`. Anything else is not for the assistant.
 *
 * @param {Error} error
 * @returns {boolean}
 */
function isRefusal(error) {
  const status = error && error.status;
  return (
    Boolean(error) && error.expose === true && status >= 400 && status < 500
  );
}

// What an `http-errors` refusal carries besides its message and status: the
// expertises at fault, a bound… (`createError(400, CODE, { max })`).
const NOT_DETAILS = new Set([
  'message',
  'name',
  'stack',
  'status',
  'statusCode',
  'expose',
  'headers',
]);
function detailsOf(error) {
  const details = Object.fromEntries(
    Object.entries(error).filter(([key]) => !NOT_DETAILS.has(key))
  );
  return Object.keys(details).length ? details : undefined;
}

/**
 * What the assistant may be told of a failure: a ProtocolError as the
 * handler threw it, or a refusal of a service (`isRefusal`), as the MCP
 * error of its status. Anything else is not for the assistant.
 *
 * @param {Error} error
 * @returns {ProtocolError|null}
 */
function toldToAssistant(error) {
  if (error instanceof ProtocolError) return error;
  if (isRefusal(error)) {
    return new ProtocolError(
      CLIENT_ERRORS[error.status] || ProtocolErrorCode.InvalidRequest,
      error.message,
      detailsOf(error)
    );
  }
  return null;
}

/**
 * A tool's answer to a request it refuses, which the assistant reads and can
 * act on, with what the refusal carries besides its message (the expertises
 * at fault, a bound) when there is any.
 *
 * @param {string} text
 * @param {Object} [details]
 * @returns {Object} the tool result
 */
function failure(text, details) {
  const said = details ? `${text} ${JSON.stringify(details)}` : text;
  return { isError: true, content: [{ type: 'text', text: said }] };
}

/**
 * A tool's answer to a request a service refused (`isRefusal`): its message
 * and what it carries besides.
 *
 * @param {Error} error
 * @returns {Object} the tool result
 */
function refused(error) {
  return failure(error.message, detailsOf(error));
}

/**
 * A tool's answer: structured, and the same as text for the clients that
 * read only that.
 *
 * @param {Object} answer
 * @returns {Object} the tool result
 */
function success(answer) {
  return {
    content: [{ type: 'text', text: JSON.stringify(answer) }],
    structuredContent: answer,
  };
}

// What a search out of its time answers (ADR 0007), in list_mailings and in
// search alike: a search to narrow, which the assistant can act on.
const SEARCH_TOO_LONG =
  'The search took too long: narrow it down, with more filters or more precise words.';

/**
 * The answer to a search the database could not finish in its time; any
 * other error is thrown again.
 *
 * @param {Error} error
 * @returns {Object} the tool result
 */
function tooLongSearch(error) {
  if (error && error.message === ERROR_CODES.SEARCH_TIMEOUT) {
    return failure(SEARCH_TOO_LONG);
  }
  throw error;
}

/**
 * The request user the services read, built from the account's fields in
 * `USER_FIELDS` (`_id`, `name`, `email`, `lang`, `role`, `_company`,
 * `isDeactivated`), with `id`, `group: { id }` and the capabilities of its
 * role (`permissions.withCapabilities`). A super admin also has
 * `selectedGroup: { id }`, the company the token is bound to, which
 * request-scope.js reads as the company it works in.
 *
 * Narrower than the app's request user (`deserializeUser` in auth.guard.js):
 * `group` is not populated, so it carries none of the company's name or
 * settings, which a handler reads itself when it needs them.
 *
 * @param {Object} record the account, as `USER_FIELDS` reads it
 * @param {string} groupId the company the token is bound to
 * @returns {Object}
 */
function toRequestUser(record, groupId) {
  const user = permissions.withCapabilities({
    ...record,
    id: String(record._id),
    group: { id: String(record._company) },
  });
  if (!permissions.can(user, CAPABILITIES.PLATFORM_MANAGE)) return user;
  return { ...user, selectedGroup: { id: String(groupId) } };
}

/**
 * Who calls, checked again on every call (ADR 0012): the token's identity is
 * only what was true at consent. The user must still be active and in the
 * company the token is bound to, and the company must still have the MCP
 * module (ADR 0017) and MCP access, so a change in the app takes effect at the
 * next call. The ids are strings the server wrote in the token, checked as
 * such before any query: an object there would be a query operator.
 *
 * @param {Object} [authInfo] the validated access token: its `scopes`, and
 *   `extra.userId` and `extra.groupId`
 * @returns {Promise<{ user: Object, group: Object, drafts: boolean }>} the
 *   request user, the company the call reads, with the fields of `GROUP_FIELDS`
 *   only, and whether it reads the drafts
 *   of skills and expertises: a token that may draft, held by someone who
 *   still may, on a connection in drafts mode (#1385, ADR 0014)
 * @throws {ProtocolError} when any of it no longer holds
 */
async function resolveIdentity(authInfo) {
  if (!authInfo) refuse('This call carries no access token.');
  if (!hasScope(authInfo, READ_SCOPE)) {
    refuse(`The access token was not granted the ${READ_SCOPE} scope.`);
  }

  const { userId, groupId } = authInfo.extra || {};
  if (!isObjectIdString(userId)) refuse(NO_ACCOUNT);
  if (!isObjectIdString(groupId)) refuse(NO_COMPANY);

  const record = await Users.findOne({
    _id: userId,
    isDeactivated: { $ne: true },
  })
    .select(USER_FIELDS)
    .lean();
  if (!record) refuse(NO_ACCOUNT);

  const user = toRequestUser(record, groupId);
  if (!permissions.canAccessGroup(user, groupId)) refuse(NO_COMPANY);

  const group = await Groups.findById(groupId).select(GROUP_FIELDS).lean();
  // Sold apart from MCP access, with no way around it (ADR 0017).
  if (!group || group.enableMcpModule !== true) refuse(NO_MCP_MODULE);
  if (group.enableMcp !== true) refuse(NO_MCP_ACCESS);
  const drafts =
    mayWrite(user, group, authInfo) &&
    (await isDraftsModeOn(authInfo.extra?.grantId));
  return { user, group, drafts };
}

// Who makes a call, resolved once for it by the call guard
// (mcp-call-guard.js), which counts it against the company only once it is
// known, and logs a refusal as one: by the request, which the SDK builds for
// each call and hands to the handler.
const identities = new WeakMap();

/**
 * Resolves who makes a call, and keeps the answer for the handler of that
 * call: the identity, or why it is refused. The MCP endpoint resolved it
 * already for the request (mcp-http.js), and keeps it on the token
 * (`authInfo.identity`): it is read from there.
 *
 * @param {Object} [ctx] the request context the SDK hands the handler
 * @returns {Promise<{ identity?: Object, refusal?: Error }>}
 */
async function identify(ctx) {
  const authInfo = ctx?.http?.authInfo;
  const answer = authInfo?.identity
    ? { identity: authInfo.identity }
    : await resolveIdentity(authInfo).then(
        (identity) => ({ identity }),
        (refusal) => ({ refusal })
      );
  if (ctx?.http) identities.set(ctx.http, answer);
  return answer;
}

// The identity of a call, as identify kept it, or resolved now for a handler
// the guard does not wrap.
async function identityOf(ctx) {
  const known = ctx?.http && identities.get(ctx.http);
  if (!known) return resolveIdentity(ctx?.http?.authInfo);
  if (known.refusal) throw known.refusal;
  return known.identity;
}

/**
 * The one way this server registers a handler (ADR 0012): who calls is
 * resolved before the handler runs, which receives the identity first, then
 * what the SDK gives it, whose last argument is the request context carrying
 * the validated token. A handler registered without it answers anyone, which
 * `mcp.primitives.test.js` walks every primitive to catch.
 *
 * What the assistant is told of a failure is what it can act on: a refusal
 * or a resource not found, as the handlers throw them (`ProtocolError`), and
 * a request a service refuses with a message meant to be shown (an
 * `http-errors` 4xx with `expose`), as the MCP error of its status, logged
 * as a warning. Anything else is logged as an error, and the assistant
 * reads a message that says nothing of the server.
 *
 * @param {Function} handler `(identity, ...sdkArguments)`
 * @returns {Function} the handler the SDK calls
 */
function withIdentity(handler) {
  return async (...args) => {
    try {
      const identity = await identityOf(args[args.length - 1]);
      return await handler(identity, ...args);
    } catch (error) {
      const told = toldToAssistant(error);
      // A request a service refused is logged too, as a warning: the
      // assistant reads why, the server keeps a trace of it.
      if (told && told !== error) {
        logger.warn(
          `[mcp] a request was refused (${error.status}): ${error.message}`
        );
      }
      if (told) throw told;
      logger.error('[mcp] a request failed', error);
      throw new ProtocolError(ProtocolErrorCode.InternalError, FAILED);
    }
  };
}

module.exports = {
  resolveIdentity,
  toRequestUser,
  identify,
  withIdentity,
  hasScope,
  mayWrite,
  isConsultant,
  isRefusal,
  failure,
  refused,
  success,
  tooLongSearch,
  READ_SCOPE,
  WRITE_SCOPE,
  SCOPES,
};
