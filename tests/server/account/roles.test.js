import Roles from '../../../packages/server/account/roles';

describe('Roles', () => {
  it('should match default roles', () => {
    const expectedRoles = {
      GROUP_ADMIN: 'company_admin',
      GROUP_ADMIN_TECH: 'company_admin_tech',
      REGULAR_USER: 'regular_user',
      REVIEWER: 'reviewer',
      WRITER: 'writer',
      SUPER_ADMIN: 'super_admin',
    };

    expect(Roles).toEqual(expectedRoles);
  });
});
