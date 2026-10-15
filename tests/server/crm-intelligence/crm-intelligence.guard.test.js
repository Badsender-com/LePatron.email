'use strict';

jest.mock('../../../packages/server/common/models.common', () => ({
  Groups: {
    findById: jest.fn(),
  },
}));

const { Groups } = require('../../../packages/server/common/models.common');
const {
  guardCrmIntelligence,
  guardCrmIntelligenceProbe,
} = require('../../../packages/server/crm-intelligence/crm-intelligence.guard');
const ERROR_CODES = require('../../../packages/server/constant/error-codes');

const GROUP_ID = '507f1f77bcf86cd799439001';

function mockGroup(group) {
  Groups.findById.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(group),
    }),
  });
}

function runGuard(guard, req) {
  const reqWithDefaults = { user: { group: { id: GROUP_ID } }, ...req };
  return new Promise((resolve) => {
    guard(reqWithDefaults, {}, (err) => resolve({ err, req: reqWithDefaults }));
  });
}

describe('guardCrmIntelligence (enforcing variant)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lets the user through and attaches req.crmGroup when flag is true', async () => {
    mockGroup({ _id: GROUP_ID, enableCrmIntelligence: true });
    const { err, req } = await runGuard(guardCrmIntelligence, {});
    expect(err).toBeUndefined();
    expect(req.crmGroup).toEqual({
      _id: GROUP_ID,
      enableCrmIntelligence: true,
    });
  });

  it('REJECTS with 403 when enableCrmIntelligence is false (M1 fix)', async () => {
    mockGroup({ _id: GROUP_ID, enableCrmIntelligence: false });
    const { err } = await runGuard(guardCrmIntelligence, {});
    expect(err).toBeDefined();
    expect(err.status).toBe(403);
    expect(err.message).toBe(ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED);
  });

  it('REJECTS with 403 when enableCrmIntelligence is undefined (default off)', async () => {
    mockGroup({ _id: GROUP_ID }); // no flag set
    const { err } = await runGuard(guardCrmIntelligence, {});
    expect(err.status).toBe(403);
  });

  it('rejects with 400 when user has no group attached', async () => {
    const { err } = await runGuard(guardCrmIntelligence, { user: {} });
    expect(err.status).toBe(400);
    expect(Groups.findById).not.toHaveBeenCalled();
  });

  it('rejects with 404 when the group does not exist', async () => {
    mockGroup(null);
    const { err } = await runGuard(guardCrmIntelligence, {});
    expect(err.status).toBe(404);
  });

  it('forwards DB errors to next() rather than crashing', async () => {
    Groups.findById.mockImplementation(() => {
      throw new Error('boom');
    });
    const { err } = await runGuard(guardCrmIntelligence, {});
    expect(err.message).toBe('boom');
  });
});

describe('guardCrmIntelligenceProbe (non-enforcing variant)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('attaches req.crmGroup AND lets through even when flag is false', async () => {
    mockGroup({ _id: GROUP_ID, enableCrmIntelligence: false });
    const { err, req } = await runGuard(guardCrmIntelligenceProbe, {});
    expect(err).toBeUndefined();
    expect(req.crmGroup).toEqual({
      _id: GROUP_ID,
      enableCrmIntelligence: false,
    });
  });

  it('still rejects when the group does not exist (probe is not an auth bypass)', async () => {
    mockGroup(null);
    const { err } = await runGuard(guardCrmIntelligenceProbe, {});
    expect(err.status).toBe(404);
  });
});

// Turned on by #1275 (super admins in the modules of their selected group)
describe.skip('guardCrmIntelligence for a super admin (ADR 0002, amended)', () => {
  const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';
  const CLIENT_GROUP = '507f1f77bcf86cd799439b01';
  const { bootstrap } = require('../../helpers/super-admin-fixtures.js');

  const superAdmin = {
    id: 'alice',
    role: 'super_admin',
    isAdmin: true,
    group: { id: PLATFORM_GROUP },
    selectedGroup: { id: CLIENT_GROUP },
  };

  // The stored groups, answered by id.
  function mockGroups(groups) {
    Groups.findById.mockImplementation((id) => ({
      select: jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue(
            groups.find((g) => String(g._id) === String(id)) || null
          ),
      }),
    }));
  }

  beforeEach(() => jest.clearAllMocks());

  it('opens the dashboards of the selected group, not of the platform group', async () => {
    mockGroups([
      { _id: PLATFORM_GROUP, enableCrmIntelligence: true },
      { _id: CLIENT_GROUP, enableCrmIntelligence: true },
    ]);

    const { err, req } = await runGuard(guardCrmIntelligence, {
      user: superAdmin,
    });

    expect(err).toBeUndefined();
    expect(req.crmGroup._id).toBe(CLIENT_GROUP);
  });

  it('lets a super admin through when the selected group does not have the module: the lock is a view, shown by the screen', async () => {
    mockGroups([
      { _id: PLATFORM_GROUP, enableCrmIntelligence: true },
      { _id: CLIENT_GROUP, enableCrmIntelligence: false },
    ]);

    const { err, req } = await runGuard(guardCrmIntelligence, {
      user: superAdmin,
    });

    expect(err).toBeUndefined();
    expect(req.crmGroup._id).toBe(CLIENT_GROUP);
  });

  it('tells the probe the module is off for the selected group, so the screen shows the lock', async () => {
    mockGroups([
      { _id: PLATFORM_GROUP, enableCrmIntelligence: true },
      { _id: CLIENT_GROUP, enableCrmIntelligence: false },
    ]);

    const { err, req } = await runGuard(guardCrmIntelligenceProbe, {
      user: superAdmin,
    });

    expect(err).toBeUndefined();
    expect(req.crmGroup).toEqual({
      _id: CLIENT_GROUP,
      enableCrmIntelligence: false,
    });
  });

  it('keeps a company admin on its own group, whatever selected group the request claims', async () => {
    mockGroups([
      { _id: GROUP_ID, enableCrmIntelligence: true },
      { _id: CLIENT_GROUP, enableCrmIntelligence: true },
    ]);
    const companyAdmin = {
      id: 'erin',
      role: 'company_admin',
      isGroupAdmin: true,
      group: { id: GROUP_ID },
      selectedGroup: { id: CLIENT_GROUP },
    };

    const { req } = await runGuard(guardCrmIntelligence, {
      user: companyAdmin,
    });

    expect(req.crmGroup._id).toBe(GROUP_ID);
  });

  it('refuses the bootstrap account, which stays in the settings', async () => {
    const { err } = await runGuard(guardCrmIntelligence, {
      user: { ...bootstrap },
    });

    expect(err.status).toBe(403);
  });
});
