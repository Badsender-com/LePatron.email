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

// What a user consents to on the consent screen in this version (ADR 0012).
const READ_SCOPE = 'mcp:read';

// What the request user may carry: never a password or a token.
const USER_FIELDS = '_id name email lang role _company isDeactivated';
// What the handlers read of the company: never its secrets.
const GROUP_FIELDS = '_id enableMcp isPlatform';

const NO_ACCOUNT = 'This account can no longer use LePatron.';
const NO_COMPANY = 'This connection is not bound to a company of this account.';
const NO_MCP_ACCESS = 'This company has no MCP access to LePatron.';
const FAILED = 'LePatron could not answer this request. Try again later.';

function refuse(message) {
  throw new ProtocolError(ProtocolErrorCode.InvalidRequest, message);
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
 *   the company the call reads, with `enableMcp` and `isPlatform` only
 * @throws {ProtocolError} when any of it no longer holds
 */
async function resolveIdentity(authInfo) {
  if (!authInfo) refuse('This call carries no access token.');
  if (!(authInfo.scopes || []).includes(READ_SCOPE)) {
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
 * or a resource not found, as the handlers throw them (`ProtocolError`).
 * Anything else is logged, and the assistant reads a message that says
 * nothing of the server.
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
      if (error instanceof ProtocolError) throw error;
      logger.error('[mcp] a request failed', error);
      throw new ProtocolError(ProtocolErrorCode.InternalError, FAILED);
    }
  };
}

module.exports = { resolveIdentity, withIdentity, READ_SCOPE };
