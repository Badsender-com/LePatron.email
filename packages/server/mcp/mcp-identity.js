'use strict';

const {
  ProtocolError,
  ProtocolErrorCode,
} = require('@modelcontextprotocol/server');
const { Users, Groups } = require('../common/models.common.js');
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

function refuse(message) {
  throw new ProtocolError(ProtocolErrorCode.InvalidRequest, message);
}

/**
 * The user as the app's routes receive it (see `deserializeUser` in
 * auth.guard.js), with a super admin's selected group set to the group the
 * token is bound to: the services that answer a tool read the user as they
 * would on a request of the app.
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
 * `mcp.identity.test.js` walks every primitive to catch.
 *
 * @param {Function} handler `(identity, ...sdkArguments)`
 * @returns {Function} the handler the SDK calls
 */
function withIdentity(handler) {
  return async (...args) => {
    const ctx = args[args.length - 1];
    const identity = await resolveIdentity(ctx?.http?.authInfo);
    return handler(identity, ...args);
  };
}

/**
 * Puts the identity check in front of a listing the SDK answers itself from
 * what is registered (`tools/list`, `resources/templates/list`), and lets the
 * caller's identity reshape its answer.
 *
 * @param {McpServer} server
 * @param {string} method
 * @param {Function} [reshape] `(answer, identity)`, the answer for this caller
 */
function guardListing(server, method, reshape = (answer) => answer) {
  // The SDK installs these handlers as tools and resources are registered, and
  // offers no other way to wrap them than its protected accessor.
  const answer = server.server._getRequestHandler(method);
  server.server.removeRequestHandler(method);
  server.server.setRequestHandler(
    method,
    withIdentity(async (identity, request, ctx) =>
      reshape(await answer(request, ctx), identity)
    )
  );
}

module.exports = { resolveIdentity, withIdentity, guardListing, READ_SCOPE };
