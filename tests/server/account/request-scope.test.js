'use strict';

// Which group a module listing reads (ADR 0002, amended): the user's own group
// for a company admin or a regular user, whatever selected group a request
// claims; the selected group for a super admin. The bootstrap account stays in
// the settings, so the modules refuse it. Writes take the group of their
// destination instead, and their rights are the permissions' business.

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

  it('refuses a super admin with no selected group, which only happens when no group exists', () => {
    expect(refusalOf(() => listingGroupIdOf(actor(ALICE)))).toBe(400);
  });
});
