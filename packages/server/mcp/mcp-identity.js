'use strict';

const {
  ProtocolError,
  ProtocolErrorCode,
} = require('@modelcontextprotocol/server');
const { Users, Groups } = require('../common/models.common.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');

// What a user consents to on the consent screen in this version (ADR 0012).
const READ_SCOPE = 'mcp:read';

// What the request user may carry: never a password or a token.
const USER_FIELDS = '_id name email lang role _company isDeactivated';

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
 * group the token is bound to, and the group must still have MCP access, so
 * a change in the app takes effect at the next call.
 *
 * @param {Object} [authInfo] the validated access token: its `scopes`, and
 *   `extra.userId` and `extra.groupId`
 * @returns {Promise<{ user: Object, group: Object }>} the request user and
 *   the group the call reads
 * @throws {ProtocolError} when any of it no longer holds
 */
async function resolveIdentity(authInfo) {
  if (!authInfo) refuse('This call carries no access token.');
  if (!(authInfo.scopes || []).includes(READ_SCOPE)) {
    refuse(`The access token was not granted the ${READ_SCOPE} scope.`);
  }

  const { userId, groupId } = authInfo.extra || {};
  const record =
    userId &&
    (await Users.findOne({ _id: userId, isDeactivated: { $ne: true } })
      .select(USER_FIELDS)
      .lean());
  if (!record) refuse('This account can no longer use LePatron.');

  const user = toRequestUser(record, groupId);
  if (!groupId || !permissions.canAccessGroup(user, groupId)) {
    refuse('This connection is not bound to a group of this account.');
  }

  const group = await Groups.findById(groupId).lean();
  if (!group || group.enableMcp !== true) {
    refuse('This group has no MCP access to LePatron.');
  }
  return { user, group };
}

module.exports = { resolveIdentity, READ_SCOPE };
