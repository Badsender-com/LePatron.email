'use strict';

// What a user may do in a group, answered in one place (ADR 0002, amended).
// The scope of a request says which group it reads or writes; these rules say
// what the user may do there. A super admin has every right, in every group,
// and so does the bootstrap account: it is kept out of the modules by the
// scope, not by its rights. A company admin has every right in its own group
// only; a regular user reads the workspaces it belongs to, or every workspace
// of its group when the group opens them all, and writes in the ones it
// belongs to.

const {
  ALICE,
  CAROL,
  DAVE,
  ERIN,
  FRANK,
  CLIENT_GROUP,
  PLATFORM_GROUP,
  USERS,
  actorFrom,
  bootstrap,
} = require('../../helpers/super-admin-fixtures.js');

const permissions = require('../../../packages/server/account/permissions.js');

const actor = (id) => actorFrom(USERS.find((u) => u._id === id));

const superAdmin = actor(ALICE);
const companyAdmin = actor(ERIN); // of the client group
const companyAdminOfAnotherGroup = actor(CAROL); // of the platform group
const member = actor(FRANK); // regular user of the client group, member below
const nonMember = actorFrom({
  _id: '507f1f77bcf86cd799439107',
  name: 'Grace',
  role: 'regular_user',
  _company: CLIENT_GROUP,
});
const outsider = actor(DAVE); // regular user of the platform group

const WORKSPACE = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Newsletters',
  group: CLIENT_GROUP,
  _users: [FRANK],
};
const CLOSED_GROUP = { id: CLIENT_GROUP, userHasAccessToAllWorkspaces: false };
const OPEN_GROUP = { id: CLIENT_GROUP, userHasAccessToAllWorkspaces: true };

// Each row reads `[who, …arguments, expected]`; the title says the answer.
const cases = (rows) =>
  rows.map(([label, ...rest]) => [
    label,
    rest[rest.length - 1] ? 'may' : 'may not',
    ...rest,
  ]);

describe('permissions', () => {
  describe('managing a group', () => {
    it.each(
      cases([
        ['a super admin, in a client group', superAdmin, CLIENT_GROUP, true],
        [
          'a super admin, in its own platform group',
          superAdmin,
          PLATFORM_GROUP,
          true,
        ],
        ['the bootstrap account', bootstrap, CLIENT_GROUP, true],
        ['a company admin, in its own group', companyAdmin, CLIENT_GROUP, true],
        [
          'a company admin, in another group',
          companyAdminOfAnotherGroup,
          CLIENT_GROUP,
          false,
        ],
        ['a regular user, in its own group', member, CLIENT_GROUP, false],
      ])
    )('%s %s', (_label, _answer, user, groupId, expected) => {
      expect(permissions.canManageGroup(user, groupId)).toBe(expected);
    });
  });

  describe('moderating the comments of a group', () => {
    it.each(
      cases([
        ['a super admin', superAdmin, true],
        ['the bootstrap account', bootstrap, true],
        ['a company admin of the group', companyAdmin, true],
        ['a company admin of another group', companyAdminOfAnotherGroup, false],
        ['a regular user of the group', member, false],
      ])
    )('%s %s', (_label, _answer, user, expected) => {
      expect(permissions.canModerateComments(user, CLIENT_GROUP)).toBe(
        expected
      );
    });
  });

  describe('reading a workspace', () => {
    it.each(
      cases([
        ['a super admin', superAdmin, CLOSED_GROUP, true],
        ['the bootstrap account', bootstrap, CLOSED_GROUP, true],
        ['a company admin of the group', companyAdmin, CLOSED_GROUP, true],
        [
          'a company admin of another group',
          companyAdminOfAnotherGroup,
          OPEN_GROUP,
          false,
        ],
        ['a member', member, CLOSED_GROUP, true],
        [
          'a non-member, when the group keeps workspaces to their members',
          nonMember,
          CLOSED_GROUP,
          false,
        ],
        [
          'a non-member, when the group opens every workspace',
          nonMember,
          OPEN_GROUP,
          true,
        ],
        [
          'a user of another group, even when the group opens every workspace',
          outsider,
          OPEN_GROUP,
          false,
        ],
      ])
    )('%s %s', (_label, _answer, user, group, expected) => {
      expect(permissions.canReadWorkspace(user, WORKSPACE, group)).toBe(
        expected
      );
    });
  });

  describe('writing in a workspace', () => {
    it.each(
      cases([
        ['a super admin', superAdmin, true],
        ['the bootstrap account', bootstrap, true],
        ['a company admin of the group, member or not', companyAdmin, true],
        ['a company admin of another group', companyAdminOfAnotherGroup, false],
        ['a member', member, true],
        ['a non-member of the group', nonMember, false],
        ['a user of another group', outsider, false],
      ])
    )('%s %s', (_label, _answer, user, expected) => {
      expect(permissions.canWriteWorkspace(user, WORKSPACE)).toBe(expected);
    });
  });

  describe('reaching a group', () => {
    const mongoose = require('mongoose');
    const ofClientGroup = (role, _id) =>
      actorFrom({ _id, name: role, role, _company: CLIENT_GROUP });
    const ROLE_MEMBERS = [
      ['a company admin', ofClientGroup('company_admin', ERIN)],
      [
        'a tech admin',
        ofClientGroup('company_admin_tech', '507f1f77bcf86cd799439111'),
      ],
      ['a regular user', member],
      ['a writer', ofClientGroup('writer', '507f1f77bcf86cd799439112')],
      ['a reviewer', ofClientGroup('reviewer', '507f1f77bcf86cd799439113')],
    ];

    it.each([
      ['a super admin', superAdmin],
      [
        'a super admin without a group of its own',
        { ...superAdmin, group: undefined },
      ],
      ['the bootstrap account', bootstrap],
    ])('lets %s reach every group, even a missing one', (_label, user) => {
      expect(permissions.canAccessGroup(user, CLIENT_GROUP)).toBe(true);
      expect(permissions.canAccessGroup(user, PLATFORM_GROUP)).toBe(true);
      expect(permissions.canAccessGroup(user, undefined)).toBe(true);
    });

    it.each(ROLE_MEMBERS)(
      'lets %s reach its own group only',
      (_label, user) => {
        expect(permissions.canAccessGroup(user, CLIENT_GROUP)).toBe(true);
        expect(permissions.canAccessGroup(user, PLATFORM_GROUP)).toBe(false);
      }
    );

    it.each([
      ['an ObjectId', new mongoose.Types.ObjectId(CLIENT_GROUP)],
      [
        'a populated group',
        { _id: new mongoose.Types.ObjectId(CLIENT_GROUP), name: 'A client' },
      ],
      ["the session's JSON", { id: CLIENT_GROUP, name: 'A client' }],
    ])('reads the group from %s', (_label, group) => {
      expect(permissions.canAccessGroup(member, group)).toBe(true);
      expect(permissions.canAccessGroup(outsider, group)).toBe(false);
    });

    // One source for every check: the role. A record without the schema's
    // virtuals is read the same as a request user.
    it('reads every right from the role of a plain record', () => {
      const superAdminRecord = { role: 'super_admin', _company: CLIENT_GROUP };
      const companyAdminRecord = {
        role: 'company_admin',
        _company: CLIENT_GROUP,
      };

      expect(permissions.canAccessGroup(superAdminRecord, PLATFORM_GROUP)).toBe(
        true
      );
      expect(permissions.canManageGroup(superAdminRecord, PLATFORM_GROUP)).toBe(
        true
      );
      expect(permissions.canManageGroup(companyAdminRecord, CLIENT_GROUP)).toBe(
        true
      );
      expect(
        permissions.canManageGroup(companyAdminRecord, PLATFORM_GROUP)
      ).toBe(false);
    });

    it('trusts no flag a user object carries without its role', () => {
      const flagsOnly = { _company: 'x' };

      expect(permissions.canAccessGroup(flagsOnly, PLATFORM_GROUP)).toBe(false);
      expect(permissions.canManageGroup(flagsOnly, 'x')).toBe(false);
    });

    it("reads the user's group from a plain record too", () => {
      const record = {
        _id: FRANK,
        role: 'regular_user',
        _company: CLIENT_GROUP,
      };

      expect(permissions.canAccessGroup(record, CLIENT_GROUP)).toBe(true);
      expect(permissions.canAccessGroup(record, PLATFORM_GROUP)).toBe(false);
    });

    it.each([
      ['no group', undefined],
      ['a null group', null],
      ['a list of groups', [CLIENT_GROUP]],
      ['a number', 1],
    ])('lets nobody but a super admin reach %s', (_label, group) => {
      expect(permissions.canAccessGroup(member, group)).toBe(false);
      expect(permissions.canAccessGroup(companyAdmin, group)).toBe(false);
    });

    it('lets no one in without a user', () => {
      expect(permissions.canAccessGroup(undefined, CLIENT_GROUP)).toBe(false);
      expect(permissions.canAccessGroup(null, CLIENT_GROUP)).toBe(false);
    });

    it('lets no one reach a group without a group of its own', () => {
      expect(
        permissions.canAccessGroup(
          { ...member, group: undefined },
          CLIENT_GROUP
        )
      ).toBe(false);
    });
  });

  it("never reads a super admin's rights from its own group", () => {
    // A super admin belongs to the platform group (ADR 0002); its rights in a
    // client group must not depend on it.
    const withoutGroup = { ...superAdmin, group: undefined };

    expect(permissions.canManageGroup(withoutGroup, CLIENT_GROUP)).toBe(true);
    expect(permissions.canWriteWorkspace(withoutGroup, WORKSPACE)).toBe(true);
  });
});

// What a role may do anywhere, read from its capabilities
// (packages/shared/access/roles.js); the scope is checked apart.
describe('capabilities', () => {
  const {
    CAPABILITIES,
    ALL_CAPABILITIES,
  } = require('../../../packages/shared/access/roles.js');

  it('gives a super admin and the bootstrap account every capability', () => {
    expect(permissions.capabilitiesOf(superAdmin)).toEqual(ALL_CAPABILITIES);
    expect(permissions.capabilitiesOf(bootstrap)).toEqual(ALL_CAPABILITIES);
  });

  it("gives anyone else their role's", () => {
    expect(permissions.can(member, CAPABILITIES.MAILING_DELETE)).toBe(true);
    expect(permissions.can(member, CAPABILITIES.GROUP_MANAGE)).toBe(false);
    expect(
      permissions.can({ role: 'reviewer' }, CAPABILITIES.MAILING_EDIT_CONTENT)
    ).toBe(false);
  });

  it('gives nothing without a user', () => {
    expect(permissions.capabilitiesOf(undefined)).toEqual([]);
    expect(permissions.can(null, CAPABILITIES.MAILING_COMMENT)).toBe(false);
  });

  it('throws on a misspelt capability, even for a super admin', () => {
    expect(() => permissions.can(superAdmin, 'mailing.remove')).toThrow();
  });
});
