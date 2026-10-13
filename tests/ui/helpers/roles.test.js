import { Roles, roleItems } from '~/helpers/constants/roles.js';

// The user forms offer the same translated roles; the super admin role only
// where choosing another one is a guarded demotion (ADR 0002).
const vm = { $t: (key) => key };

describe('roleItems', () => {
  it('offers the group roles', () => {
    expect(roleItems(vm).map((item) => item.value)).toEqual([
      Roles.REGULAR_USER,
      Roles.WRITER,
      Roles.REVIEWER,
      Roles.GROUP_ADMIN_TECH,
      Roles.GROUP_ADMIN,
    ]);
  });

  it('puts the super admin role first when asked', () => {
    expect(
      roleItems(vm, { includeSuperAdmin: true }).map((item) => item.value)
    ).toEqual([
      Roles.SUPER_ADMIN,
      Roles.REGULAR_USER,
      Roles.WRITER,
      Roles.REVIEWER,
      Roles.GROUP_ADMIN_TECH,
      Roles.GROUP_ADMIN,
    ]);
  });

  it('translates every label', () => {
    expect(roleItems(vm, { includeSuperAdmin: true })[0].text).toBe(
      'users.roles.superAdmin'
    );
  });
});
