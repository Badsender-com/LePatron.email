'use strict';

// Which group a module request reads or writes (ADR 0002, amended).
// - A listing that names no resource (the workspace tree, the dashboards)
//   reads the user's own group for a company admin or a regular user, and the
//   selected group for a super admin.
// - A request that names a workspace, a folder or a mailing, to read it or to
//   write in it, takes that resource's group, whatever group is selected; the
//   rights to do so are the permissions' business.
// - The bootstrap account stays in the settings: the modules refuse it.
// The selected group on the user is the resolved one (#1274 resolves it on
// every request, fallbacks included).

jest.mock('../../../packages/server/common/models.common.js', () => ({}));

const {
  ALICE,
  ERIN,
  FRANK,
  CLIENT_GROUP,
  PLATFORM_GROUP,
  USERS,
  actorFrom,
  bootstrap,
} = require('../../helpers/super-admin-fixtures.js');

const OTHER_CLIENT_GROUP = '507f1f77bcf86cd799439b02';

const actor = (id, extra = {}) =>
  actorFrom({ ...USERS.find((u) => u._id === id), ...extra });

function refusalOf(fn) {
  try {
    fn();
  } catch (err) {
    return err.status;
  }
  return 'no refusal';
}

// Turned on by #1275 (super admins in the modules of their selected group)
describe.skip('the group a module listing reads', () => {
  let listingGroupIdOf;

  beforeAll(() => {
    // Required here, not at the top of the file: the module doesn't exist
    // until #1275 ships it, and a top-level require would break the suite.
    ({
      listingGroupIdOf,
    } = require('../../../packages/server/account/request-scope.js'));
  });

  it("is a super admin's selected group, not its own platform group", () => {
    const superAdmin = actor(ALICE, { _selectedGroup: CLIENT_GROUP });

    expect(listingGroupIdOf(superAdmin)).toBe(CLIENT_GROUP);
  });

  it('follows the super admin when it selects another group', () => {
    const superAdmin = actor(ALICE, { _selectedGroup: OTHER_CLIENT_GROUP });

    expect(listingGroupIdOf(superAdmin)).toBe(OTHER_CLIENT_GROUP);
  });

  it("is a company admin's own group", () => {
    expect(listingGroupIdOf(actor(ERIN))).toBe(CLIENT_GROUP);
  });

  it("is a regular user's own group", () => {
    expect(listingGroupIdOf(actor(FRANK))).toBe(CLIENT_GROUP);
  });

  it('ignores a selected group on a company admin, who cannot widen its scope', () => {
    const companyAdmin = actor(ERIN, { _selectedGroup: PLATFORM_GROUP });

    expect(listingGroupIdOf(companyAdmin)).toBe(CLIENT_GROUP);
  });

  it('ignores a selected group on a regular user', () => {
    const regularUser = actor(FRANK, { _selectedGroup: PLATFORM_GROUP });

    expect(listingGroupIdOf(regularUser)).toBe(CLIENT_GROUP);
  });

  it('refuses the bootstrap account, which stays in the settings', () => {
    expect(refusalOf(() => listingGroupIdOf({ ...bootstrap }))).toBe(403);
  });

  it('refuses the bootstrap account even with a group chosen in its session', () => {
    const withChoice = { ...bootstrap, selectedGroup: { id: CLIENT_GROUP } };

    expect(refusalOf(() => listingGroupIdOf(withChoice))).toBe(403);
  });

  it('refuses a super admin with no selected group: resolved on every request, it is missing only when no group exists', () => {
    expect(refusalOf(() => listingGroupIdOf(actor(ALICE)))).toBe(400);
  });
});

// Turned on by #1275 (super admins in the modules of their selected group)
describe.skip('the group a module request naming a resource reads or writes', () => {
  let resourceGroupIdOf;

  beforeAll(() => {
    ({
      resourceGroupIdOf,
    } = require('../../../packages/server/account/request-scope.js'));
  });

  it("is the resource's group for a super admin, whatever group is selected", () => {
    const superAdmin = actor(ALICE, { _selectedGroup: OTHER_CLIENT_GROUP });

    expect(resourceGroupIdOf(superAdmin, CLIENT_GROUP)).toBe(CLIENT_GROUP);
  });

  it("is the resource's group for a company admin, whose rights then decide", () => {
    expect(resourceGroupIdOf(actor(ERIN), PLATFORM_GROUP)).toBe(PLATFORM_GROUP);
  });

  it('refuses the bootstrap account, on a read as on a write', () => {
    expect(
      refusalOf(() => resourceGroupIdOf({ ...bootstrap }, CLIENT_GROUP))
    ).toBe(403);
  });
});
