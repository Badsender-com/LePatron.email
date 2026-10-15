import { Roles, roleItems } from '~/helpers/constants/roles.js';
import { capabilitiesOfRole } from '../../../packages/shared/access/roles.js';

// The user forms offer the roles the actor may give, by the server's rule:
// nobody gives a role with more rights than their own. The super admin role
// only where choosing another one is a guarded demotion (ADR 0002).
const vm = { $t: (key) => key };
const offered = (options) => roleItems(vm, options).map((item) => item.value);
const as = (role) => capabilitiesOfRole(role);

describe('roleItems', () => {
  it('offers every group role to a tech admin', () => {
    expect(offered({ grantableWith: as(Roles.GROUP_ADMIN_TECH) })).toEqual([
      Roles.REGULAR_USER,
      Roles.WRITER,
      Roles.REVIEWER,
      Roles.GROUP_ADMIN_TECH,
      Roles.GROUP_ADMIN,
    ]);
  });

  it('leaves the tech admin role out for a company admin', () => {
    expect(offered({ grantableWith: as(Roles.GROUP_ADMIN) })).toEqual([
      Roles.REGULAR_USER,
      Roles.WRITER,
      Roles.REVIEWER,
      Roles.GROUP_ADMIN,
    ]);
  });

  it("keeps the edited account's role listed, to show it", () => {
    expect(
      offered({
        grantableWith: as(Roles.GROUP_ADMIN),
        currentRole: Roles.GROUP_ADMIN_TECH,
      })
    ).toContain(Roles.GROUP_ADMIN_TECH);
  });

  it('offers nothing to someone who holds nothing', () => {
    expect(offered({})).toEqual([]);
  });

  it('puts the super admin role first when asked', () => {
    expect(
      offered({
        grantableWith: as(Roles.SUPER_ADMIN),
        includeSuperAdmin: true,
      })[0]
    ).toBe(Roles.SUPER_ADMIN);
  });

  it('translates every label', () => {
    expect(
      roleItems(vm, { grantableWith: as(Roles.SUPER_ADMIN) }).map(
        (item) => item.text
      )
    ).toEqual([
      'users.roles.regularUser',
      'users.roles.writer',
      'users.roles.reviewer',
      'users.roles.companyAdminTech',
      'users.roles.groupAdmin',
    ]);
  });
});
