'use strict';

// GET /emails-groups lists the lists of the group the user works in: its own,
// or a super admin's selected group (ADR 0002, amended), never the platform's.

jest.mock('../../../packages/server/emails-group/emails-group.service', () => ({
  listEmailsGroups: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../../packages/server/utils/logger', () => ({ log: jest.fn() }));

const emailsGroupService = require('../../../packages/server/emails-group/emails-group.service');
const controller = require('../../../packages/server/emails-group/emails-group.controller');

const PLATFORM = '507f1f77bcf86cd799439a01';
const CLIENT = '507f1f77bcf86cd799439a02';

const list = (user) =>
  new Promise((resolve, reject) =>
    controller.listEmailsGroups({ user }, { json: resolve }, reject)
  );

beforeEach(() => jest.clearAllMocks());

describe('GET /emails-groups', () => {
  it.each([
    [
      'a super admin, in its selected group',
      {
        role: 'super_admin',
        group: { id: PLATFORM },
        selectedGroup: { id: CLIENT },
      },
    ],
    [
      'a company admin, in its own',
      { role: 'company_admin', group: { id: CLIENT } },
    ],
  ])('lists the lists of %s', async (_label, user) => {
    await list(user);

    expect(emailsGroupService.listEmailsGroups).toHaveBeenCalledWith(CLIENT);
  });
});
