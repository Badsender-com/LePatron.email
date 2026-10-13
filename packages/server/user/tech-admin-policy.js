'use strict';

const { Forbidden } = require('http-errors');

const Roles = require('../account/roles.js');
const ERROR_CODES = require('../constant/error-codes.js');

/**
 * Who grants and revokes the tech admin role. A tech admin is a company admin
 * with the integrations on top, so a company admin who could give the role
 * would give themselves the integrations: only a super admin or a tech admin
 * does. The super admin role has its own, stricter rule (super-admin-policy.js).
 */

const canManageTechAdminRole = (actor) =>
  !!(actor?.isAdmin || actor?.isGroupAdminTech);

/**
 * Before a user is created with `role`, or `target` is updated to `role`.
 * `role` is undefined when the request leaves the role alone; the edit page
 * re-sends the current role, which is not a change.
 */
function assertCanSetRole(actor, target, role) {
  if (role === undefined || canManageTechAdminRole(actor)) return;
  const currentRole = target?.role;
  if (role === currentRole) return;
  if (
    role === Roles.GROUP_ADMIN_TECH ||
    currentRole === Roles.GROUP_ADMIN_TECH
  ) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_TECH_ADMIN_ROLE_CHANGE);
  }
}

module.exports = { assertCanSetRole, canManageTechAdminRole };
