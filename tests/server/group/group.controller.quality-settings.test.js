'use strict';

// PUT /groups/:groupId with `qualitySettings`: the state and thresholds of a
// group's checks (epic #1193, ADR 0004). A company admin sets their own group's
// (the route guard keeps them to it), so the key must be on the company admin
// whitelist; every value goes through the sanitizer, and a partial update keeps
// what it does not mention.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Groups: { findById: jest.fn() },
  Profiles: {},
  Templates: {},
  Mailings: {},
}));
jest.mock('../../../packages/server/group/group.service.js', () => ({
  updateGroup: jest.fn(),
}));
jest.mock('../../../packages/server/profile/profile.service.js', () => ({}));
jest.mock(
  '../../../packages/server/emails-group/emails-group.service.js',
  () => ({})
);
jest.mock(
  '../../../packages/server/personalized-variables/personalized-variable.service.js',
  () => ({})
);
jest.mock('../../../packages/server/group/group-ftp.service.js', () => ({
  processCredentialsForUpdate: jest.fn((body) => ({ ...body })),
  validateSshKeyOrThrow: jest.fn(),
  maskFtpCredentials: jest.fn((group) => group),
}));
jest.mock('../../../packages/server/workspace/workspace.service.js', () => ({
  createWorkspace: jest.fn(),
  findWorkspaces: jest.fn(),
}));

const { Groups } = require('../../../packages/server/common/models.common.js');
const groupService = require('../../../packages/server/group/group.service.js');
const groupController = require('../../../packages/server/group/group.controller.js');

const GROUP_ID = '507f1f77bcf86cd799439001';
const groupAdmin = { isGroupAdmin: true, isAdmin: false };
const superAdmin = { isGroupAdmin: false, isAdmin: true };

async function update({ user = groupAdmin, body, stored = {} }) {
  Groups.findById.mockReturnValue({
    lean: jest
      .fn()
      .mockResolvedValue({ id: GROUP_ID, name: 'Company A', ...stored }),
  });
  const res = { json: jest.fn() };
  await groupController.update(
    { params: { groupId: GROUP_ID }, body, user },
    res
  );
  return groupService.updateGroup.mock.calls[0]
    ? groupService.updateGroup.mock.calls[0][0]
    : null;
}

const rejection = (promise) =>
  promise.then(
    () => {
      throw new Error('expected a refusal');
    },
    (error) => error
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PUT /groups/:groupId — check states', () => {
  it('lets a company admin turn a check off for their group', async () => {
    const payload = await update({
      body: {
        qualitySettings: { checks: { 'emoji-placement': { state: 'off' } } },
      },
    });
    expect(payload.qualitySettings).toEqual({
      checks: { 'emoji-placement': { state: 'off' } },
    });
  });

  it('lets a super admin make a check blocking', async () => {
    const payload = await update({
      user: superAdmin,
      body: {
        qualitySettings: {
          checks: { 'unfilled-links': { state: 'blocking' } },
        },
      },
    });
    expect(payload.qualitySettings.checks['unfilled-links']).toEqual({
      state: 'blocking',
    });
  });

  it('keeps the settings a partial update does not mention', async () => {
    const payload = await update({
      stored: {
        qualitySettings: { checks: { headings: { state: 'off' } } },
      },
      body: {
        qualitySettings: { checks: { 'emoji-placement': { state: 'off' } } },
      },
    });
    expect(payload.qualitySettings.checks).toEqual({
      headings: { state: 'off' },
      'emoji-placement': { state: 'off' },
    });
  });

  it('brings a check back to its default with null', async () => {
    const payload = await update({
      stored: {
        qualitySettings: { checks: { headings: { state: 'off' } } },
      },
      body: { qualitySettings: { checks: { headings: { state: null } } } },
    });
    expect(payload.qualitySettings.checks).toEqual({});
  });

  it.each([
    ['an unknown check', { 'no-such-check': { state: 'off' } }],
    ['an unknown state', { headings: { state: 'loud' } }],
    ['a check that is not an object', { headings: 'off' }],
    // Inherited names are no checks of the catalogue (security review).
    ['an inherited name', { constructor: { state: 'off' } }],
    ['another inherited name', { toString: { state: 'off' } }],
    ['__proto__', JSON.parse('{"__proto__": {"state": "off"}}')],
  ])('refuses %s with a 422', async (_label, checks) => {
    const error = await rejection(
      update({ body: { qualitySettings: { checks } } })
    );
    expect(error.status).toBe(422);
    expect(error.message).toBe('INVALID_QUALITY_SETTINGS');
    expect(groupService.updateGroup).not.toHaveBeenCalled();
  });
});

// Turned on by #1198 (set a group's thresholds)
describe.skip('PUT /groups/:groupId — thresholds', () => {
  it('stores a threshold within its bounds', async () => {
    const payload = await update({
      body: {
        qualitySettings: { checks: { subject: { thresholds: { long: 30 } } } },
      },
    });
    expect(payload.qualitySettings.checks.subject).toEqual({
      thresholds: { long: 30 },
    });
  });

  it('clears a threshold with null, back to the default', async () => {
    const payload = await update({
      stored: {
        qualitySettings: {
          checks: { subject: { state: 'on', thresholds: { long: 30 } } },
        },
      },
      body: {
        qualitySettings: {
          checks: { subject: { thresholds: { long: null } } },
        },
      },
    });
    expect(payload.qualitySettings.checks.subject).toEqual({ state: 'on' });
  });

  it.each([
    [
      'a value under its minimum',
      { 'small-font': { thresholds: { minSize: 2 } } },
    ],
    [
      'a value over its maximum',
      { 'html-size': { thresholds: { maxKb: 99999 } } },
    ],
    [
      'a value that is not a number',
      { subject: { thresholds: { long: '30' } } },
    ],
    ['an unknown threshold', { subject: { thresholds: { width: 30 } } }],
    [
      'a threshold on a check without any',
      { headings: { thresholds: { x: 1 } } },
    ],
  ])('refuses %s with a 422', async (_label, checks) => {
    const error = await rejection(
      update({ body: { qualitySettings: { checks } } })
    );
    expect(error.status).toBe(422);
    expect(error.message).toBe('INVALID_QUALITY_SETTINGS');
  });
});

describe('POST /groups — quality settings', () => {
  it('refuses invalid settings before creating the group', async () => {
    const error = await rejection(
      groupController.create(
        {
          body: {
            name: 'Company B',
            qualitySettings: { checks: { 'no-such-check': { state: 'off' } } },
          },
          user: superAdmin,
        },
        { json: jest.fn() }
      )
    );
    expect(error.status).toBe(422);
    expect(error.message).toBe('INVALID_QUALITY_SETTINGS');
  });
});
