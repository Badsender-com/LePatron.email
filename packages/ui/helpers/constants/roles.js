import { ROLES, isRoleWithin } from '../../../shared/access/roles.js';

// The roles and what each may do are defined once, in
// packages/shared/access/roles.js: the server and the editor read the same
// file. What the UI adds is how it shows them.
export const Roles = ROLES;

// Order controls display order in the role picker. super_admin is offered
// separately, see roleItems() below.
export const ASSIGNABLE_ROLES = [
  Roles.REGULAR_USER,
  Roles.WRITER,
  Roles.REVIEWER,
  Roles.GROUP_ADMIN_TECH,
  Roles.GROUP_ADMIN,
];

const ROLE_LABEL_KEYS = {
  [Roles.SUPER_ADMIN]: 'users.roles.superAdmin',
  [Roles.REGULAR_USER]: 'users.roles.regularUser',
  [Roles.WRITER]: 'users.roles.writer',
  [Roles.REVIEWER]: 'users.roles.reviewer',
  [Roles.GROUP_ADMIN_TECH]: 'users.roles.companyAdminTech',
  [Roles.GROUP_ADMIN]: 'users.roles.groupAdmin',
};

export const getRoleLabelKey = (role) => ROLE_LABEL_KEYS[role];

/**
 * Whether the actor may manage `account` (edit, reset, deactivate,
 * reactivate): the server's rule, nobody manages an account with more rights
 * than their own. An account stored without a role is a regular user.
 *
 * @param {string[]} capabilities the actor's
 * @param {Object} account
 * @returns {boolean}
 */
export const canManageAccount = (capabilities, account) =>
  isRoleWithin((account && account.role) || Roles.REGULAR_USER, capabilities);

/**
 * The roles a user form offers, translated: those the actor may give, the
 * server's rule (nobody gives a role with more rights than their own). The
 * account's current role stays listed, so the form shows it. The super admin
 * role only where choosing another one is a demotion, guarded and confirmed
 * (ADR 0002).
 *
 * @param {Object} vm component instance (for $t)
 * @param {Object} options
 * @param {string[]} options.grantableWith the actor's capabilities
 * @param {string} [options.currentRole] the edited account's role
 * @param {boolean} [options.includeSuperAdmin]
 * @returns {Array<{text: string, value: string}>}
 */
export function roleItems(
  vm,
  { grantableWith = [], currentRole, includeSuperAdmin = false } = {}
) {
  const roles = ASSIGNABLE_ROLES.filter(
    (role) => role === currentRole || isRoleWithin(role, grantableWith)
  );
  if (includeSuperAdmin) roles.unshift(Roles.SUPER_ADMIN);
  return roles.map((value) => ({ text: vm.$t(getRoleLabelKey(value)), value }));
}
