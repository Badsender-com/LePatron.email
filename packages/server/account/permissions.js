'use strict';

const { isBootstrapAccount } = require('./bootstrap-account.js');
const {
  ROLES,
  ALL_CAPABILITIES,
  assertCapability,
  capabilitiesOfRole,
  isRoleWithin,
} = require('../../shared/access/roles.js');

// What a user may do in a group, answered in one place (ADR 0002, amended).
// The scope of a request says which group it reads or writes; these rules
// say what the user may do there:
// - a super admin, and the bootstrap account, have every right in every
//   group (the modules keep the bootstrap account out by the scope);
// - a company admin has every right in its own group only;
// - a regular user reads the workspaces it belongs to, or every workspace of
//   its group when the group opens them all, and writes in the ones it
//   belongs to.
// - what a role may do anywhere is its list of capabilities
//   (packages/shared/access/roles.js), asked through `can`: a right that is
//   not listed is refused.
// Restricting a role later changes its branch here, or its capabilities, and
// nowhere else.

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

function hasEveryRight(user) {
  return !!user && (user.isAdmin === true || isBootstrapAccount(user));
}

function belongsTo(user, groupId) {
  return sameId(user && user.group && user.group.id, groupId);
}

function isCompanyAdminOf(user, groupId) {
  return !!user && user.isGroupAdmin === true && belongsTo(user, groupId);
}

function groupOfWorkspace(workspace) {
  const group = workspace && (workspace.group || workspace._company);
  return group && group._id ? group._id : group;
}

function isWorkspaceMember(user, workspace) {
  return (workspace._users || []).some((member) =>
    sameId(member && member._id ? member._id : member, user.id)
  );
}

/**
 * Everything the user may do, wherever it does it; the scope of a request is
 * checked apart. Sent to the UI and the editor with the current user, so they
 * show what the server will accept.
 *
 * @param {Object} user the request user
 * @returns {string[]}
 */
function capabilitiesOf(user) {
  if (!user) return [];
  if (hasEveryRight(user)) return ALL_CAPABILITIES;
  // Accounts created before roles existed carry none, and have always been
  // regular users.
  const role = user.role == null ? ROLES.REGULAR_USER : user.role;
  return capabilitiesOfRole(role);
}

/**
 * The user as the clients receive it, with its capabilities: the UI and the
 * editor show what the server will accept. On every request user and in the
 * sign-in answer.
 *
 * @param {Object} user a plain user, as serialised
 * @returns {Object}
 */
function withCapabilities(user) {
  return { ...user, capabilities: capabilitiesOf(user) };
}

/**
 * @param {Object} user the request user
 * @param {string} capability one of CAPABILITIES; a misspelt one throws
 * @returns {boolean}
 */
function can(user, capability) {
  assertCapability(capability);
  return capabilitiesOf(user).includes(capability);
}

/**
 * Nobody grants a role that can do more than they can: a company admin does
 * not make a tech admin, nor a super admin.
 *
 * @param {Object} actor the request user
 * @param {string} role the role to give
 * @returns {boolean}
 */
function canGrantRole(actor, role) {
  return isRoleWithin(role, capabilitiesOf(actor));
}

/**
 * Nobody manages an account that can do more than they can: editing it, its
 * email included, resetting its password, deactivating or reactivating it
 * would let a company admin take over a tech admin's account. Where the
 * target is (`userScope`) and the super admin's own rules
 * (`super-admin-policy`) are checked apart.
 *
 * @param {Object} actor the request user
 * @param {Object} target the managed account
 * @returns {boolean}
 */
function canManageUser(actor, target) {
  const role = target.role == null ? ROLES.REGULAR_USER : target.role;
  return canGrantRole(actor, role);
}

function canManageGroup(user, groupId) {
  return hasEveryRight(user) || isCompanyAdminOf(user, groupId);
}

function canModerateComments(user, groupId) {
  return canManageGroup(user, groupId);
}

/**
 * @param {Object} user the request user
 * @param {Object} workspace with its group and its `_users`
 * @param {Object} group the workspace's group, for `userHasAccessToAllWorkspaces`
 */
function canReadWorkspace(user, workspace, group) {
  if (hasEveryRight(user)) return true;
  const groupId = groupOfWorkspace(workspace);
  if (!belongsTo(user, groupId)) return false;
  return (
    isCompanyAdminOf(user, groupId) ||
    isWorkspaceMember(user, workspace) ||
    !!(group && group.userHasAccessToAllWorkspaces)
  );
}

function canWriteWorkspace(user, workspace) {
  if (hasEveryRight(user)) return true;
  const groupId = groupOfWorkspace(workspace);
  if (!belongsTo(user, groupId)) return false;
  return isCompanyAdminOf(user, groupId) || isWorkspaceMember(user, workspace);
}

module.exports = {
  can,
  capabilitiesOf,
  withCapabilities,
  canGrantRole,
  canManageUser,
  canManageGroup,
  canModerateComments,
  canReadWorkspace,
  canWriteWorkspace,
};
