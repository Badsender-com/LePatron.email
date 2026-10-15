'use strict';

const { isBootstrapAccount } = require('./bootstrap-account.js');

// What a user may do in a group, answered in one place (ADR 0002, amended).
// The scope of a request says which group it reads or writes; these rules
// say what the user may do there:
// - a super admin, and the bootstrap account, have every right in every
//   group (the modules keep the bootstrap account out by the scope);
// - a company admin has every right in its own group only;
// - a regular user reads the workspaces it belongs to, or every workspace of
//   its group when the group opens them all, and writes in the ones it
//   belongs to.
// Restricting a role later changes its branch here, and nowhere else.

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
  canManageGroup,
  canModerateComments,
  canReadWorkspace,
  canWriteWorkspace,
};
