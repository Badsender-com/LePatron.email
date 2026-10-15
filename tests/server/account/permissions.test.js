'use strict';

// What a user may do in a group, answered in one place (ADR 0002, amended).
// The scope of a request says which group it reads or writes; these rules say
// what the user may do there. A super admin has every right, in every group,
// and so does the bootstrap account: it is kept out of the modules by the
// scope, not by its rights. A company admin has every right in its own group
// only; a regular user reads the workspaces it belongs to, or every workspace
// of its group when the group opens them all, and writes in the ones it
// belongs to.

jest.mock('../../../packages/server/common/models.common.js', () => ({}));

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

// Turned on by #1275 (super admins in the modules of their selected group)
describe.skip('permissions', () => {
  let permissions;

  beforeAll(() => {
    // Required here, not at the top of the file: the module doesn't exist
    // until #1275 ships it, and a top-level require would break the suite.
    permissions = require('../../../packages/server/account/permissions.js');
  });

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

  it("never reads a super admin's rights from its own group", () => {
    // A super admin belongs to the platform group (ADR 0002); its rights in a
    // client group must not depend on it.
    const withoutGroup = { ...superAdmin, group: undefined };

    expect(permissions.canManageGroup(withoutGroup, CLIENT_GROUP)).toBe(true);
    expect(permissions.canWriteWorkspace(withoutGroup, WORKSPACE)).toBe(true);
  });
});
