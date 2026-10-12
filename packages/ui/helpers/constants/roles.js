export const Roles = {
  SUPER_ADMIN: 'super_admin',
  GROUP_ADMIN: 'company_admin',
  REGULAR_USER: 'regular_user',
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
  const items = [
    { text: vm.$t('users.roles.groupAdmin'), value: Roles.GROUP_ADMIN },
    { text: vm.$t('users.roles.regularUser'), value: Roles.REGULAR_USER },
  ];
  if (includeSuperAdmin) {
    items.unshift({
      text: vm.$t('users.roles.superAdmin'),
      value: Roles.SUPER_ADMIN,
    });
  }
  return items;
}
