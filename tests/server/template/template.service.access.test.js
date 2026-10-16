'use strict';

// Creating a mailing from a template needs the template to be within reach:
// one of the user's own group, or of any group for a super admin, who creates
// mailings in the group it works in (ADR 0002, amended).

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Templates: {},
}));

const templateService = require('../../../packages/server/template/template.service.js');

const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';
const CLIENT_GROUP = '507f1f77bcf86cd799439b01';

const template = { name: 'Newsletter', group: CLIENT_GROUP };

const superAdmin = {
  id: 'alice',
  role: 'super_admin',
  isAdmin: true,
  group: { id: PLATFORM_GROUP },
};
const member = { id: 'frank', group: { id: CLIENT_GROUP } };
const companyAdminOfAnotherGroup = {
  id: 'carol',
  role: 'company_admin',
  isGroupAdmin: true,
  group: { id: PLATFORM_GROUP },
};

describe('reaching a template to create a mailing', () => {
  it("lets a super admin use a client group's template", async () => {
    await expect(
      templateService.doesUserHaveAccess(superAdmin, template)
    ).resolves.toBeUndefined();
  });

  it("lets a user use its own group's template", async () => {
    await expect(
      templateService.doesUserHaveAccess(member, template)
    ).resolves.toBeUndefined();
  });

  it("refuses a company admin another group's template", async () => {
    await expect(
      templateService.doesUserHaveAccess(companyAdminOfAnotherGroup, template)
    ).rejects.toMatchObject({ status: 404 });
  });
});
