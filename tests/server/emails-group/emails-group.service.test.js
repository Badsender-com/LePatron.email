'use strict';

jest.mock('../../../packages/server/common/models.common', () => ({
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
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
}));

const emailsGroupService = require('../../../packages/server/emails-group/emails-group.service');
const ERROR_CODES = require('../../../packages/server/constant/error-codes');
const {
  EmailsGroups,
} = require('../../../packages/server/common/models.common');

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
    const user = {
      role: 'super_admin',
      group: { id: TENANT_A },
    };

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
    const user = { group: { id: TENANT_A } };

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
    const user = { group: { id: TENANT_A } };

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
    const user = { group: { id: TENANT_A } };

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

  it.each([
    ['an object carrying the own id', { _id: TENANT_A }],
    ['an object with an id field', { id: TENANT_A }],
    ['a list', [TENANT_A]],
  ])('refuses a group id given as %s, for every user', async (_l, groupId) => {
    for (const user of [
      { role: 'company_admin', group: { id: TENANT_A } },
      { role: 'super_admin' },
    ]) {
      await expect(
        emailsGroupService.createEmailsGroup({ ...baseInput, user, groupId })
      ).rejects.toMatchObject({
        status: 400,
        message: ERROR_CODES.INVALID_OBJECT_ID,
      });
    }
    expect(EmailsGroups.create).not.toHaveBeenCalled();
  });
});

// The request users as passport hands them over: a super admin, a member of
// the emails group's company and a member of another company.
describe('emails-group.service: reaching an emails group', () => {
  const {
    ALICE,
    DAVE,
    FRANK,
    CLIENT_GROUP,
    USERS,
    actorFrom,
  } = require('../../helpers/super-admin-fixtures.js');
  const { Types } = require('mongoose');

  const actor = (id) => actorFrom(USERS.find((u) => u._id === id));
  const EMAILS_GROUP_ID = '507f1f77bcf86cd799439e01';
  const ACTORS = [
    ['a super admin may', actor(ALICE), true],
    ['a member of its company may', actor(FRANK), true],
    ['a member of another company may not', actor(DAVE), false],
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    const emailsGroup = {
      id: EMAILS_GROUP_ID,
      _company: Types.ObjectId(CLIENT_GROUP),
      emails: 'a@b.com',
    };
    EmailsGroups.exists.mockResolvedValue(true);
    EmailsGroups.findById.mockResolvedValue(emailsGroup);
    EmailsGroups.findOne.mockResolvedValue(emailsGroup);
    EmailsGroups.updateOne.mockResolvedValue({ ok: 1 });
    EmailsGroups.deleteOne.mockResolvedValue({ ok: 1 });
  });

  const expectAnswer = async (promise, reaches) => {
    if (reaches) {
      await expect(promise).resolves.toBeDefined();
    } else {
      await expect(promise).rejects.toMatchObject({
        status: 404,
        message: ERROR_CODES.EMAIL_GROUP_NOT_FOUND,
      });
    }
  };

  it.each(ACTORS)('%s read it', async (_label, user, reaches) => {
    await expectAnswer(
      emailsGroupService.getEmailsGroup({
        emailsGroupId: EMAILS_GROUP_ID,
        user,
      }),
      reaches
    );
  });

  it.each(ACTORS)('%s edit it', async (_label, user, reaches) => {
    await expectAnswer(
      emailsGroupService.editEmailsGroup({
        ...baseInput,
        emailsGroupId: EMAILS_GROUP_ID,
        user,
      }),
      reaches
    );
    expect(EmailsGroups.updateOne).toHaveBeenCalledTimes(reaches ? 1 : 0);
  });

  it.each(ACTORS)('%s delete it', async (_label, user, reaches) => {
    await expectAnswer(
      emailsGroupService.deleteEmailsGroup({
        emailsGroupId: EMAILS_GROUP_ID,
        user,
      }),
      reaches
    );
    expect(EmailsGroups.deleteOne).toHaveBeenCalledTimes(reaches ? 1 : 0);
  });

  // The test send reads the list among the sender's own company's, whoever
  // sends it.
  it.each([
    ['finds it for a test send from its company', CLIENT_GROUP, true],
    [
      'does not find it for a test send from another company',
      '507f1f77bcf86cd799439a01',
      false,
    ],
    ['does not find it without a company', undefined, false],
  ])('%s', async (_label, groupId, found) => {
    await expectAnswer(
      emailsGroupService.getEmailsGroupOfGroup({
        emailsGroupId: EMAILS_GROUP_ID,
        groupId,
      }),
      found
    );
  });
});
