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
 * @param {Object} vm component instance (for $t)
 * @param {{includeSuperAdmin?: boolean}} [options]
 * @returns {Array<{text: string, value: string}>}
 */
export function roleItems(vm, { includeSuperAdmin = false } = {}) {
  const items = ASSIGNABLE_ROLES.map((value) => ({
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
