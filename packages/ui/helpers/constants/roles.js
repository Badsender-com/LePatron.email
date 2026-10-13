import { ASSIGNABLE_ROLES, getRoleLabelKey } from '~/helpers/roles.js';

export const Roles = {
  SUPER_ADMIN: 'super_admin',
  GROUP_ADMIN: 'company_admin',
  GROUP_ADMIN_TECH: 'company_admin_tech',
  REGULAR_USER: 'regular_user',
  REVIEWER: 'reviewer',
  WRITER: 'writer',
};

/**
 * The roles a user form offers, translated. The super admin role only where
 * choosing another one is a demotion, guarded and confirmed (ADR 0002).
 *
 * The tech admin role only where the actor may grant it: a company admin
 * cannot (server rule, tech-admin-policy.js), so the picker does not offer it.
 *
 * @param {Object} vm component instance (for $t)
 * @param {{includeSuperAdmin?: boolean, includeTechAdmin?: boolean}} [options]
 * @returns {Array<{text: string, value: string}>}
 */
export function roleItems(
  vm,
  { includeSuperAdmin = false, includeTechAdmin = true } = {}
) {
  const items = ASSIGNABLE_ROLES.filter(
    (value) => includeTechAdmin || value !== Roles.GROUP_ADMIN_TECH
  ).map((value) => ({
    text: vm.$t(getRoleLabelKey(value)),
    value,
  }));
  if (includeSuperAdmin) {
    items.unshift({
      text: vm.$t('users.roles.superAdmin'),
      value: Roles.SUPER_ADMIN,
    });
  }
  return items;
}
