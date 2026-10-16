'use strict';

const { Forbidden } = require('http-errors');

const permissions = require('../account/permissions.js');
const ERROR_CODES = require('../constant/error-codes.js');

/**
 * Nobody hands out, or takes over, more rights than they hold (ADR 0004).
 * A company admin who could make a tech admin, or edit a tech admin's email
 * and reset their password, would give themselves the integrations. Compared
 * on the capabilities of the roles (account/permissions.js), so a new role
 * needs no rule here. The super admin role keeps its own, stricter rules
 * (super-admin-policy.js), checked first so their error codes stay.
 */

/**
 * Before a user is created with `role`, or `target` is updated to `role`.
 * `role` is undefined when the request leaves the role alone; the edit page
 * re-sends the current role, which is not a change.
 *
 * @param {Object} actor the request user
 * @param {Object|undefined} target the updated account, none on a creation
 * @param {string|undefined} role
 */
function assertCanSetRole(actor, target, role) {
  if (role === undefined || role === target?.role) return;
  if (!permissions.canGrantRole(actor, role)) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_ROLE_GRANT);
  }
}

/**
 * Before `target` is edited, reset, deactivated or reactivated by `actor`.
 *
 * @param {Object} actor the request user
 * @param {Object} target the managed account
 */
function assertCanManage(actor, target) {
  if (!permissions.canManageUser(actor, target)) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_USER_MANAGEMENT);
  }
}

module.exports = { assertCanSetRole, assertCanManage };
