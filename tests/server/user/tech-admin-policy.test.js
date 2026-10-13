'use strict';

// Only a super admin or a tech admin grants or revokes the tech admin role: a
// company admin who could would give themselves the integrations.

const techAdminPolicy = require('../../../packages/server/user/tech-admin-policy.js');

const FORBIDDEN = 'FORBIDDEN_TECH_ADMIN_ROLE_CHANGE';

const superAdmin = { isAdmin: true, role: 'super_admin' };
const techAdmin = {
  isGroupAdmin: true,
  isGroupAdminTech: true,
  role: 'company_admin_tech',
};
const companyAdmin = { isGroupAdmin: true, role: 'company_admin' };
const bootstrap = { isAdmin: true };

const refuses = (fn) => {
  let error;
  try {
    fn();
  } catch (err) {
    error = err;
  }
  expect(error).toBeDefined();
  expect(error.status).toBe(403);
  expect(error.message).toBe(FORBIDDEN);
};

describe('assertCanSetRole', () => {
  describe('a company admin', () => {
    it('cannot give the tech admin role to a user', () =>
      refuses(() =>
        techAdminPolicy.assertCanSetRole(
          companyAdmin,
          { role: 'regular_user' },
          'company_admin_tech'
        )
      ));

    it('cannot give it to themselves', () =>
      refuses(() =>
        techAdminPolicy.assertCanSetRole(
          companyAdmin,
          companyAdmin,
          'company_admin_tech'
        )
      ));

    it('cannot create a tech admin', () =>
      refuses(() =>
        techAdminPolicy.assertCanSetRole(
          companyAdmin,
          undefined,
          'company_admin_tech'
        )
      ));

    it('cannot take the role away from a tech admin', () =>
      refuses(() =>
        techAdminPolicy.assertCanSetRole(
          companyAdmin,
          { role: 'company_admin_tech' },
          'regular_user'
        )
      ));

    it('can still change the other roles', () => {
      expect(() =>
        techAdminPolicy.assertCanSetRole(
          companyAdmin,
          { role: 'regular_user' },
          'writer'
        )
      ).not.toThrow();
      expect(() =>
        techAdminPolicy.assertCanSetRole(companyAdmin, undefined, 'reviewer')
      ).not.toThrow();
    });

    it('can save a tech admin without touching the role', () => {
      const target = { role: 'company_admin_tech' };
      expect(() =>
        techAdminPolicy.assertCanSetRole(companyAdmin, target, undefined)
      ).not.toThrow();
      expect(() =>
        techAdminPolicy.assertCanSetRole(
          companyAdmin,
          target,
          'company_admin_tech'
        )
      ).not.toThrow();
    });
  });

  describe.each([
    ['a tech admin', techAdmin],
    ['a super admin', superAdmin],
    ['the bootstrap account', bootstrap],
  ])('%s', (_name, actor) => {
    it('grants the tech admin role', () => {
      expect(() =>
        techAdminPolicy.assertCanSetRole(
          actor,
          { role: 'company_admin' },
          'company_admin_tech'
        )
      ).not.toThrow();
    });

    it('revokes it', () => {
      expect(() =>
        techAdminPolicy.assertCanSetRole(
          actor,
          { role: 'company_admin_tech' },
          'company_admin'
        )
      ).not.toThrow();
    });
  });

  it('lets no one without a role through when the request names a tech admin', () =>
    refuses(() =>
      techAdminPolicy.assertCanSetRole(
        { role: 'writer' },
        { role: 'regular_user' },
        'company_admin_tech'
      )
    ));
});
