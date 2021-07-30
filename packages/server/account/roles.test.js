import Roles from './roles';

describe('Roles', () => {
  it('should match default roles', () => {
    const expectedRoles = {
      GROUP_ADMIN: 'company_admin',
      REGULAR_USER: 'regular_user',
      SUPER_ADMIN: 'super_admin',
    };

    expect(Roles).toEqual(expectedRoles);
  });
});
