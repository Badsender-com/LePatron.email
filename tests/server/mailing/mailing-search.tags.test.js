'use strict';

// Searching every accessible workspace (epic #1144, ADR 0007): the tag filter
// stays offered in the "all" search scope. Tags belong to the group, so a
// request for them that names no location answers the tags of the group the
// listing reads: the user's own, or a super admin's selected group. Today it
// is refused with PARENT_NOT_PROVIDED.
//
// `Mailings.findTags` stands for the stored tags of each group.

const CLIENT_GROUP = '507f1f77bcf86cd799439b01';
const OTHER_GROUP = '507f1f77bcf86cd799439c01';
const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';

const mockTagsByGroup = {
  [CLIENT_GROUP]: ['promo', 'weekly'],
  [OTHER_GROUP]: ['elsewhere'],
};

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: {
    findTags: jest.fn(async ({ _company }) => mockTagsByGroup[_company] || []),
  },
  Workspaces: {},
  Folders: {},
  Groups: {},
  Galleries: {},
  Tags: {},
  Users: {},
  Templates: {},
}));
jest.mock('../../../packages/server/template/template.service.js', () => ({}));
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const config = require('../../../packages/server/node.config.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const mailingService = require('../../../packages/server/mailing/mailing.service');

const regularUser = {
  id: '507f1f77bcf86cd799430001',
  role: 'regular_user',
  group: { id: CLIENT_GROUP },
};
const superAdmin = {
  id: '507f1f77bcf86cd799430006',
  role: 'super_admin',
  group: { id: PLATFORM_GROUP },
  selectedGroup: { id: OTHER_GROUP },
};
const bootstrapAccount = { id: config.admin.id, name: 'admin' };

const tagsWithoutLocation = (user) =>
  mailingService.listTagsForWorkspaceOrFolder({ user });

// Turned on by #1314 (search every accessible workspace)
describe.skip('the tags of the "all" search scope', () => {
  it("answers the tags of the user's group", async () => {
    expect(await tagsWithoutLocation(regularUser)).toEqual({
      tags: ['promo', 'weekly'],
    });
  });

  it("answers a super admin the tags of the selected group, not of the platform's", async () => {
    expect(await tagsWithoutLocation(superAdmin)).toEqual({
      tags: ['elsewhere'],
    });
  });

  it('refuses the bootstrap account, which stays in the settings', async () => {
    await expect(tagsWithoutLocation(bootstrapAccount)).rejects.toMatchObject({
      status: 403,
      message: ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION,
    });
  });
});
