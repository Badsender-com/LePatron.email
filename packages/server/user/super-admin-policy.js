'use strict';

const { BadRequest, Conflict, Forbidden } = require('http-errors');

const Roles = require('../account/roles.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { Users, Groups } = require('../common/models.common.js');
const logger = require('../utils/logger.js');
const { isBootstrapAccount } = require('../account/bootstrap-account.js');

/**
 * The guardrails of the super admin role (ADR 0002), as checks the user and
 * group controllers run before acting:
 *
 * - only a super admin grants or revokes the role, or manages a super admin;
 * - a super admin always belongs to the platform group;
 * - nobody demotes or deactivates themselves;
 * - at least one active super admin remains in the database, the bootstrap
 *   account not counting;
 * - the platform flag cannot leave a group with active super admins.
 *
 * Each refusal is its own error code, so the UI shows its own message.
 */

const ROLE_VALUES = Object.values(Roles);

const isSuperAdmin = (user) => user?.role === Roles.SUPER_ADMIN;
const isSelf = (actor, target) => String(actor?.id) === String(target.id);
const companyIdOf = (user) => String(user._company?._id || user._company);

/**
 * A role read from a request must be one of the product's roles, as a plain
 * value: an object (`role[$ne]=x`) never reaches a query.
 */
function assertRoleParam(role) {
  if (role === undefined) return;
  if (typeof role !== 'string' || !ROLE_VALUES.includes(role)) {
    throw new BadRequest(ERROR_CODES.INVALID_ROLE_PARAM);
  }
}

function findPlatformGroup() {
  return Groups.findOne({ isPlatform: true });
}

function countActiveSuperAdmins(groupId) {
  const filter = { role: Roles.SUPER_ADMIN, isDeactivated: { $ne: true } };
  if (groupId) filter._company = groupId;
  return Users.countDocuments(filter);
}

async function assertPlatformGroupIs(groupId) {
  const platform = await findPlatformGroup();
  if (!platform) throw new Conflict(ERROR_CODES.PLATFORM_GROUP_NOT_FOUND);
  if (groupId && String(groupId) !== String(platform._id)) {
    throw new Forbidden(ERROR_CODES.SUPER_ADMIN_OUTSIDE_PLATFORM_GROUP);
  }
  return String(platform._id);
}

/**
 * The group a new user goes to. A super admin goes to the platform group,
 * whether or not the request names it.
 */
async function groupForCreation(actor, { role, groupId }) {
  assertRoleParam(role);
  if (role !== Roles.SUPER_ADMIN) return groupId;
  if (!actor?.isAdmin) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_SUPER_ADMIN_ROLE_CHANGE);
  }
  return assertPlatformGroupIs(groupId);
}

// After the action, at least one active super admin must remain. Acting on
// a deactivated super admin does not change the count.
async function assertNotLastSuperAdmin(target) {
  if (target.isDeactivated) return;
  const remaining = (await countActiveSuperAdmins()) - 1;
  if (remaining < 1) {
    throw new Conflict(ERROR_CODES.LAST_SUPER_ADMIN_PROTECTED);
  }
}

function assertCanManage(actor, target) {
  if (isSuperAdmin(target) && !actor?.isAdmin) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_SUPER_ADMIN_MANAGEMENT);
  }
}

/**
 * Before an update of `target` by `actor`. `role` is the requested role, or
 * undefined when the request leaves it alone; the edit page re-sends the
 * current role, which is not a change.
 */
async function assertCanUpdate(actor, target, role) {
  assertRoleParam(role);
  const roleChanges = role !== undefined && role !== target.role;
  if (!roleChanges) return assertCanManage(actor, target);

  const givesOrTakesTheRole =
    isSuperAdmin(target) || role === Roles.SUPER_ADMIN;
  if (!givesOrTakesTheRole) return;
  if (!actor?.isAdmin) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_SUPER_ADMIN_ROLE_CHANGE);
  }
  if (role === Roles.SUPER_ADMIN) {
    await assertPlatformGroupIs(companyIdOf(target));
    return;
  }
  if (isSelf(actor, target)) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_SUPER_ADMIN_SELF_DEMOTION);
  }
  await assertNotLastSuperAdmin(target);
}

/**
 * Reactivating a super admin brings an active super admin back: it must
 * still be in the platform group, which may have moved meanwhile.
 */
async function assertCanActivate(actor, target) {
  if (!isSuperAdmin(target)) return;
  assertCanManage(actor, target);
  await assertPlatformGroupIs(companyIdOf(target));
}

async function assertCanDeactivate(actor, target) {
  if (!isSuperAdmin(target)) return;
  assertCanManage(actor, target);
  if (isSelf(actor, target)) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_SUPER_ADMIN_SELF_DEACTIVATION);
  }
  await assertNotLastSuperAdmin(target);
}

/**
 * A trace of who did what to a super admin account, until the audit log
 * (#1102) records it: logged when the target is a super admin or becomes one.
 * `role` is the requested role; `previousRole` the role before the action.
 * Ids only, no personal data.
 */
function logAction(actor, action, target, role, previousRole) {
  if (!isSuperAdmin(target) && role !== Roles.SUPER_ADMIN) return;
  const transition =
    role !== undefined && previousRole !== undefined && role !== previousRole
      ? ` (${previousRole} -> ${role})`
      : '';
  logger.info(
    `[super-admin] ${action}${transition} on ${target.id} by ${actor?.id}`
  );
}

/**
 * Before the platform flag leaves `group`: unset, moved to `destination`, or
 * gone with the group. Active super admins hold it there, except when the
 * bootstrap account moves it to another group: the super admins then follow
 * it, so that they stay in the platform group (ADR 0002).
 *
 * @returns {Promise<boolean>} whether the super admins must follow the flag
 */
async function assertFlagCanLeave(group, { actor, destination } = {}) {
  if (!group) return false;
  if ((await countActiveSuperAdmins(group._id)) === 0) return false;
  if (destination && isBootstrapAccount(actor)) return true;
  throw new Conflict(ERROR_CODES.PLATFORM_GROUP_HAS_SUPER_ADMINS);
}

/**
 * Moves every super admin of `from`, deactivated ones included, to `to`,
 * once the platform flag moved there.
 */
async function moveSuperAdmins(actor, from, to) {
  const result = await Users.updateMany(
    { _company: from._id, role: Roles.SUPER_ADMIN },
    { $set: { _company: to._id } }
  );
  logger.info(
    `[super-admin] ${result.nModified} moved with the platform flag from ${from._id} to ${to._id} by ${actor?.id}`
  );
}

module.exports = {
  assertRoleParam,
  groupForCreation,
  assertCanUpdate,
  assertCanManage,
  assertCanActivate,
  assertCanDeactivate,
  assertFlagCanLeave,
  moveSuperAdmins,
  logAction,
};
