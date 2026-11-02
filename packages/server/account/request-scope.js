'use strict';

const createError = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
const { isBootstrapAccount } = require('./bootstrap-account.js');
const permissions = require('./permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');

// Which group a module request reads or writes (ADR 0002, amended):
// - a listing that names no resource (the workspace tree, the dashboards)
//   reads the user's own group, or a super admin's selected group;
// - a request that names a workspace, a folder or a mailing takes that
//   resource's group, whatever group is selected;
// - the bootstrap account stays in the settings: the modules refuse it.
// What the user may do in that group is the permissions' business.

function refuseBootstrapAccount(user) {
  if (isBootstrapAccount(user)) {
    throw new createError.Forbidden(ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION);
  }
}

/**
 * @param {Object} user the request user, its selected group resolved
 * @returns {string|null} a super admin's selected group, anyone else's own
 */
function selectedGroupIdOf(user) {
  const group =
    user &&
    (permissions.can(user, CAPABILITIES.PLATFORM_MANAGE)
      ? user.selectedGroup
      : user.group);
  return group && group.id ? String(group.id) : null;
}

/**
 * @param {Object} user the request user, its selected group resolved
 * @returns {string} the group a listing that names no resource reads
 */
function listingGroupIdOf(user) {
  refuseBootstrapAccount(user);
  const groupId = selectedGroupIdOf(user);
  if (!groupId) {
    throw new createError.BadRequest(ERROR_CODES.GROUP_NOT_FOUND);
  }
  return groupId;
}

/**
 * A write moves or creates something within one group: a mailing from a
 * template of its group, a copy or a move into a workspace of the same group.
 * Only a super admin can reach two groups, so only it can trip this.
 *
 * @param {string} sourceGroupId
 * @param {string} destinationGroupId
 */
function assertSameGroup(sourceGroupId, destinationGroupId) {
  const groupOf = (value) => (value && value._id ? value._id : value);
  const source = groupOf(sourceGroupId);
  const destination = groupOf(destinationGroupId);
  if (source && destination && String(source) !== String(destination)) {
    throw new createError.Forbidden(ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION);
  }
}

/**
 * @param {Object} user the request user
 * @param {string} resourceGroupId the group of the workspace, folder or mailing
 * @returns {string} the group the request reads or writes
 */
function resourceGroupIdOf(user, resourceGroupId) {
  refuseBootstrapAccount(user);
  return String(resourceGroupId);
}

module.exports = {
  selectedGroupIdOf,
  listingGroupIdOf,
  resourceGroupIdOf,
  refuseBootstrapAccount,
  assertSameGroup,
};
