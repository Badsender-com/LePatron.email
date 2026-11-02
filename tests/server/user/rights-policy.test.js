'use strict';

// Nobody hands out, or takes over, more rights than they hold. A company admin
// who could make a tech admin, or edit a tech admin's email and then reset
// their password, would give themselves the integrations.

const rightsPolicy = require('../../../packages/server/user/rights-policy.js');
const config = require('../../../packages/server/node.config.js');

const superAdmin = { role: 'super_admin' };
const techAdmin = { role: 'company_admin_tech' };
const companyAdmin = { role: 'company_admin' };
// The account of the deployment configuration: known by its id, no role.
const bootstrap = { id: config.admin.id };

const refuses = (fn, code) => {
  let error;
  try {
    fn();
  } catch (err) {
    error = err;
  }
  expect(error).toBeDefined();
  expect(error.status).toBe(403);
  expect(error.message).toBe(code);
};

describe('assertCanSetRole', () => {
  const refusesGrant = (fn) => refuses(fn, 'FORBIDDEN_ROLE_GRANT');

  describe('a company admin', () => {
    it('cannot give the tech admin role to a user', () =>
      refusesGrant(() =>
        rightsPolicy.assertCanSetRole(
          companyAdmin,
          { role: 'regular_user' },
          'company_admin_tech'
        )
      ));

    it('cannot give it to themselves', () =>
      refusesGrant(() =>
        rightsPolicy.assertCanSetRole(
          companyAdmin,
          companyAdmin,
          'company_admin_tech'
        )
      ));

    it('cannot create a tech admin', () =>
      refusesGrant(() =>
        rightsPolicy.assertCanSetRole(
          companyAdmin,
          undefined,
          'company_admin_tech'
        )
      ));

    it.each(['company_admin', 'regular_user', 'writer', 'reviewer'])(
      'gives the %s role',
      (role) => {
        expect(() =>
          rightsPolicy.assertCanSetRole(
            companyAdmin,
            { role: 'regular_user' },
            role
          )
        ).not.toThrow();
        expect(() =>
          rightsPolicy.assertCanSetRole(companyAdmin, undefined, role)
        ).not.toThrow();
      }
    );

    it('leaves a role alone, or re-sent unchanged, without a check', () => {
      const target = { role: 'company_admin_tech' };
      expect(() =>
        rightsPolicy.assertCanSetRole(companyAdmin, target, undefined)
      ).not.toThrow();
      expect(() =>
        rightsPolicy.assertCanSetRole(
          companyAdmin,
          target,
          'company_admin_tech'
        )
      ).not.toThrow();
    });
  });

  it.each([
    ['a tech admin', techAdmin],
    ['a super admin', superAdmin],
    ['the bootstrap account', bootstrap],
  ])('%s grants the tech admin role', (_name, actor) => {
    expect(() =>
      rightsPolicy.assertCanSetRole(
        actor,
        { role: 'company_admin' },
        'company_admin_tech'
      )
    ).not.toThrow();
  });

  it('refuses a tech admin the super admin role', () =>
    refusesGrant(() =>
      rightsPolicy.assertCanSetRole(techAdmin, undefined, 'super_admin')
    ));

  it('refuses a writer every role above its own', () =>
    refusesGrant(() =>
      rightsPolicy.assertCanSetRole(
        { role: 'writer' },
        { role: 'reviewer' },
        'regular_user'
      )
    ));

  it('refuses a role the product does not define', () =>
    refusesGrant(() =>
      rightsPolicy.assertCanSetRole(superAdmin, undefined, 'owner')
    ));
});

describe('assertCanManage', () => {
  const refusesManagement = (fn) => refuses(fn, 'FORBIDDEN_USER_MANAGEMENT');

  describe('a company admin', () => {
    // Editing the email and then resetting the password is taking the
    // account: both are refused, and so is taking the role away.
    it('cannot manage a tech admin', () =>
      refusesManagement(() =>
        rightsPolicy.assertCanManage(companyAdmin, techAdmin)
      ));

    it('cannot manage a super admin', () =>
      refusesManagement(() =>
        rightsPolicy.assertCanManage(companyAdmin, superAdmin)
      ));

    it.each(['company_admin', 'regular_user', 'writer', 'reviewer'])(
      'manages a %s',
      (role) => {
        expect(() =>
          rightsPolicy.assertCanManage(companyAdmin, { role })
        ).not.toThrow();
      }
    );

    it('manages an account stored before the roles, a regular user', () => {
      expect(() =>
        rightsPolicy.assertCanManage(companyAdmin, {})
      ).not.toThrow();
    });
  });

  it.each([
    ['a tech admin', techAdmin],
    ['a super admin', superAdmin],
    ['the bootstrap account', bootstrap],
  ])('%s manages a tech admin', (_name, actor) => {
    expect(() => rightsPolicy.assertCanManage(actor, techAdmin)).not.toThrow();
  });
});
