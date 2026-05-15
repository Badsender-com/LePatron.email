'use strict';

const emailsGroupService = require('./emails-group.service');
const ERROR_CODES = require('../constant/error-codes');

jest.mock('../common/models.common', () => ({
  EmailsGroups: {
    exists: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  },
}));
jest.mock('../utils/logger.js', () => ({ log: jest.fn() }));

const { EmailsGroups } = require('../common/models.common');

const TENANT_A = '507f1f77bcf86cd799439001';
const TENANT_B = '507f1f77bcf86cd799439002';

const baseInput = {
  name: 'My list',
  emails: ['a@b.com'],
};

describe('emails-group.service.createEmailsGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    EmailsGroups.exists.mockResolvedValue(false);
    EmailsGroups.create.mockImplementation((doc) => Promise.resolve(doc));
  });

  it('lets a super-admin create an emails-group in any tenant', async () => {
    const user = { isAdmin: true, group: { id: TENANT_A } };

    await emailsGroupService.createEmailsGroup({
      ...baseInput,
      user,
      groupId: TENANT_B,
    });

    expect(EmailsGroups.create).toHaveBeenCalledWith(
      expect.objectContaining({ _company: TENANT_B })
    );
  });

  it('lets a group-admin create an emails-group in their own tenant when groupId matches', async () => {
    const user = { isAdmin: false, group: { id: TENANT_A } };

    await emailsGroupService.createEmailsGroup({
      ...baseInput,
      user,
      groupId: TENANT_A,
    });

    expect(EmailsGroups.create).toHaveBeenCalledWith(
      expect.objectContaining({ _company: TENANT_A })
    );
  });

  it('lets a group-admin create an emails-group without passing groupId (defaults to their tenant)', async () => {
    const user = { isAdmin: false, group: { id: TENANT_A } };

    await emailsGroupService.createEmailsGroup({
      ...baseInput,
      user,
      // no groupId
    });

    expect(EmailsGroups.create).toHaveBeenCalledWith(
      expect.objectContaining({ _company: TENANT_A })
    );
  });

  it('REJECTS a group-admin trying to create an emails-group in another tenant (H2 fix)', async () => {
    const user = { isAdmin: false, group: { id: TENANT_A } };

    await expect(
      emailsGroupService.createEmailsGroup({
        ...baseInput,
        user,
        groupId: TENANT_B,
      })
    ).rejects.toMatchObject({
      status: 403,
      message: ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION,
    });

    expect(EmailsGroups.create).not.toHaveBeenCalled();
  });

  it('rejects when no user is provided', async () => {
    await expect(
      emailsGroupService.createEmailsGroup({ ...baseInput, user: null })
    ).rejects.toMatchObject({ status: 401 });
  });
});
