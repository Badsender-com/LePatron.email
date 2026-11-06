'use strict';

const {
  ProtocolError,
  ProtocolErrorCode,
} = require('@modelcontextprotocol/server');
const { Users, Groups } = require('../common/models.common.js');
const logger = require('../utils/logger.js');
const permissions = require('../account/permissions.js');
const { isObjectIdString } = require('../utils/model.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');

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

// What the request user may carry: never a password or a token.
const USER_FIELDS = '_id name email lang role _company isDeactivated';
// What the handlers read of the company: never its secrets. Whether it
// allows retex, and how long its logs are kept, for a feedback; whether its
// users read every workspace, for the rights on its mailings.
const GROUP_FIELDS =
  '_id enableMcp isPlatform allowRetex logRetentionDays userHasAccessToAllWorkspaces';

const NO_ACCOUNT = 'This account can no longer use LePatron.';
const NO_COMPANY = 'This connection is not bound to a company of this account.';
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
 * company the token is bound to, and the company must still have MCP access,
 * so a change in the app takes effect at the next call. The ids are strings
 * the server wrote in the token, checked as such before any query: an object
 * there would be a query operator.
 *
 * @param {Object} [authInfo] the validated access token: its `scopes`, and
 *   `extra.userId` and `extra.groupId`
 * @returns {Promise<{ user: Object, group: Object }>} the request user and
 *   the company the call reads, with the fields of `GROUP_FIELDS` only
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
  if (!group || group.enableMcp !== true) refuse(NO_MCP_ACCESS);
  return { user, group };
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
      const ctx = args[args.length - 1];
      const identity = await resolveIdentity(ctx?.http?.authInfo);
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
  withIdentity,
  hasScope,
  isRefusal,
  failure,
  refused,
  success,
  READ_SCOPE,
  WRITE_SCOPE,
  SCOPES,
};
