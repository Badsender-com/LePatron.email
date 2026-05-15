'use strict';

jest.mock('../common/models.common', () => ({
  Groups: {
    findById: jest.fn(),
  },
}));

const { Groups } = require('../common/models.common');
const {
  guardCrmIntelligence,
  guardCrmIntelligenceProbe,
} = require('./crm-intelligence.guard');
const ERROR_CODES = require('../constant/error-codes');

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
