export const SUPER_ADMIN = 'super_admin';
export const GROUP_ADMIN = 'company_admin';
export const GROUP_ADMIN_TECH = 'company_admin_tech';
export const REGULAR_USER = 'regular_user';
export const REVIEWER = 'reviewer';
export const WRITER = 'writer';

// Order controls display order in the role picker. super_admin is not
// assignable from a group: it is promoted from the super admins screen (ADR
// 0002), so it is offered by the picker only on demand (includeSuperAdmin).
export const ASSIGNABLE_ROLES = [
  REGULAR_USER,
  WRITER,
  REVIEWER,
  GROUP_ADMIN_TECH,
  GROUP_ADMIN,
];

const roleLabelKeys = {
  [SUPER_ADMIN]: 'users.roles.superAdmin',
  [REGULAR_USER]: 'users.roles.regularUser',
  [WRITER]: 'users.roles.writer',
  [REVIEWER]: 'users.roles.reviewer',
  [GROUP_ADMIN_TECH]: 'users.roles.companyAdminTech',
  [GROUP_ADMIN]: 'users.roles.companyAdmin',
};

export const getRoleLabelKey = (role) => roleLabelKeys[role];
