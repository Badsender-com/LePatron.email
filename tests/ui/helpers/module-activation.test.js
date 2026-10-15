import { isModuleLocked, isFlagEnabled } from '~/helpers/module-activation.js';

// A super admin sees a module of its selected group the way a company admin of
// that group does (ADR 0002, amended): locked when the group does not have it.
// The settings of that module stay reachable, so it can be configured or
// enabled. The caller passes the selected group, which for any other user is
// their own group.

const EMAIL_BUILDER = {
  id: 'email-builder',
  enabledFlag: 'enableEmailBuilder',
};
const CRM_INTELLIGENCE = {
  id: 'crm-intelligence',
  enabledFlag: 'enableCrmIntelligence',
};
const FREE_MODULE = { id: 'design-system', enabledFlag: null };

const superAdmin = { isAdmin: true, role: 'super_admin' };
const companyAdmin = { isGroupAdmin: true, role: 'company_admin' };

const withCrm = { enableEmailBuilder: true, enableCrmIntelligence: true };
const withoutCrm = { enableEmailBuilder: true, enableCrmIntelligence: false };
const withoutEmailBuilder = { enableEmailBuilder: false };

describe('a module of the selected group, for a super admin', () => {
  it('is locked when the selected group does not have it', () => {
    expect(isModuleLocked(CRM_INTELLIGENCE, superAdmin, withoutCrm)).toBe(true);
  });

  it('is open when the selected group has it', () => {
    expect(isModuleLocked(CRM_INTELLIGENCE, superAdmin, withCrm)).toBe(false);
  });

  it('answers like for a company admin of the group', () => {
    [EMAIL_BUILDER, CRM_INTELLIGENCE, FREE_MODULE].forEach((module) => {
      [withCrm, withoutCrm].forEach((group) => {
        expect(isModuleLocked(module, superAdmin, group)).toBe(
          isModuleLocked(module, companyAdmin, group)
        );
      });
    });
  });
});

// Today's behaviour, which the change must keep.
describe('a module of the group, for a company admin', () => {
  it('is locked when the group does not have it', () => {
    expect(isModuleLocked(CRM_INTELLIGENCE, companyAdmin, withoutCrm)).toBe(
      true
    );
  });

  it('is open when the group has it', () => {
    expect(isModuleLocked(CRM_INTELLIGENCE, companyAdmin, withCrm)).toBe(false);
  });

  it('is never locked when the module is free', () => {
    expect(isModuleLocked(FREE_MODULE, companyAdmin, withoutCrm)).toBe(false);
  });
});

describe('the Email Builder settings of a selected group without the module', () => {
  it('stay reachable for a super admin', () => {
    expect(
      isFlagEnabled('enableEmailBuilder', superAdmin, withoutEmailBuilder)
    ).toBe(true);
  });

  it('stay closed to a company admin', () => {
    expect(
      isFlagEnabled('enableEmailBuilder', companyAdmin, withoutEmailBuilder)
    ).toBe(false);
  });
});
