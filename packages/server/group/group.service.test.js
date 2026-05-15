'use strict';

jest.mock('../common/models.common', () => ({
  Groups: { findById: jest.fn() },
  Users: { find: jest.fn() },
  Mailings: {},
  Workspaces: {},
  Folders: {},
  Profiles: {},
}));
jest.mock('../workspace/workspace.service.js', () => ({}));
jest.mock('../utils/logger.js', () => ({ log: jest.fn() }));

const { Groups } = require('../common/models.common');
const groupService = require('./group.service');

const GROUP_ID = '507f1f77bcf86cd799439001';

describe('groupService.findById — L2 projection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns only _id (projection restored, no sensitive fields)', async () => {
    const selectMock = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: GROUP_ID }),
    });
    Groups.findById.mockReturnValue({ select: selectMock });

    const result = await groupService.findById(GROUP_ID);

    expect(selectMock).toHaveBeenCalledWith('_id');
    expect(result).toEqual({ _id: GROUP_ID });
    expect(result).not.toHaveProperty('enableEmailBuilder');
    expect(result).not.toHaveProperty('enableCrmIntelligence');
    expect(result).not.toHaveProperty('downloadMailingWithFtpImages');
  });

  it('throws when the group does not exist', async () => {
    Groups.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });

    await expect(groupService.findById('missing')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('groupService.findFullById — L2 escape hatch for callers that need full doc', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the full populated document', async () => {
    Groups.findById.mockResolvedValue({
      _id: GROUP_ID,
      enableEmailBuilder: true,
      enableCrmIntelligence: false,
      name: 'Acme',
    });

    const result = await groupService.findFullById(GROUP_ID);
    expect(result.name).toBe('Acme');
    expect(result.enableEmailBuilder).toBe(true);
  });

  it('throws when the group does not exist', async () => {
    Groups.findById.mockResolvedValue(null);
    await expect(groupService.findFullById('missing')).rejects.toMatchObject({
      status: 404,
    });
  });
});
