'use strict';

// Smoke test for the new `hasProfiles` field added to GET /groups.
// The response shape changed from a raw group document to
// { ...group, hasProfiles: boolean }. Pin the contract so we notice if a
// future refactor drops the field or returns the wrong type.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Groups: { find: jest.fn() },
  Profiles: { distinct: jest.fn() },
  Templates: {},
  Mailings: {},
}));
jest.mock('../../../packages/server/group/group.service.js', () => ({}));
jest.mock('../../../packages/server/profile/profile.service.js', () => ({}));
jest.mock(
  '../../../packages/server/emails-group/emails-group.service.js',
  () => ({})
);
jest.mock(
  '../../../packages/server/personalized-variables/personalized-variable.service.js',
  () => ({})
);
jest.mock('../../../packages/server/group/group-ftp.service.js', () => ({}));
jest.mock('../../../packages/server/workspace/workspace.service.js', () => ({
  createWorkspace: jest.fn(),
  findWorkspaces: jest.fn(),
}));

const {
  Groups,
  Profiles,
} = require('../../../packages/server/common/models.common.js');
const groupController = require('../../../packages/server/group/group.controller.js');

const GROUP_A = '507f1f77bcf86cd799439001';
const GROUP_B = '507f1f77bcf86cd799439002';

function makeGroup(id, name) {
  return {
    _id: id,
    name,
    toJSON() {
      return { _id: id, name };
    },
  };
}

describe('groupController.list — hasProfiles contract', () => {
  beforeEach(() => jest.clearAllMocks());

  function callList() {
    const req = {};
    const res = { json: jest.fn() };
    return groupController.list(req, res).then(() => res.json.mock.calls[0][0]);
  }

  it('adds hasProfiles=true on groups that own at least one profile', async () => {
    Groups.find.mockReturnValue({
      sort: jest
        .fn()
        .mockResolvedValue([
          makeGroup(GROUP_A, 'Acme'),
          makeGroup(GROUP_B, 'Bee'),
        ]),
    });
    // Profiles.distinct returns the array of group ids that have profiles.
    // Items may be ObjectId-like; the controller stringifies via String().
    Profiles.distinct.mockResolvedValue([GROUP_A]);

    const body = await callList();

    expect(body.items).toHaveLength(2);
    const byId = Object.fromEntries(body.items.map((g) => [g._id, g]));
    expect(byId[GROUP_A].hasProfiles).toBe(true);
    expect(byId[GROUP_B].hasProfiles).toBe(false);
  });

  it('hasProfiles is a strict boolean on every returned group', async () => {
    Groups.find.mockReturnValue({
      sort: jest
        .fn()
        .mockResolvedValue([
          makeGroup(GROUP_A, 'Acme'),
          makeGroup(GROUP_B, 'Bee'),
        ]),
    });
    Profiles.distinct.mockResolvedValue([]);

    const body = await callList();

    body.items.forEach((group) => {
      expect(typeof group.hasProfiles).toBe('boolean');
    });
  });

  it('still returns the rest of the group payload (name, _id) alongside hasProfiles', async () => {
    Groups.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([makeGroup(GROUP_A, 'Acme')]),
    });
    Profiles.distinct.mockResolvedValue([]);

    const body = await callList();

    expect(body.items[0]).toMatchObject({
      _id: GROUP_A,
      name: 'Acme',
      hasProfiles: false,
    });
  });

  it('handles ObjectId-like values from Profiles.distinct (string coercion)', async () => {
    Groups.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([makeGroup(GROUP_A, 'Acme')]),
    });
    // Simulate the BSON ObjectId shape: { toString: () => '...' }
    Profiles.distinct.mockResolvedValue([{ toString: () => GROUP_A }]);

    const body = await callList();

    expect(body.items[0].hasProfiles).toBe(true);
  });
});
