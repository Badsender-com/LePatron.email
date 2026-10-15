'use strict';

// The template listing is shared (ADR 0002, amended). Without a group, it
// lists every group's templates to a super admin, for the global templates
// page. The new-mailing screen passes the selected group, and gets that
// group's templates only. Anyone else gets their own group's, whatever group
// the request names.

const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';
const CLIENT_GROUP = '507f1f77bcf86cd799439b01';

const mockStoredTemplates = [
  { name: 'Client newsletter', _company: CLIENT_GROUP },
  { name: 'Client promo', _company: CLIENT_GROUP },
  { name: 'Platform digest', _company: PLATFORM_GROUP },
];

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Templates: {
    findForApi: jest.fn((filter) =>
      Promise.resolve(
        mockStoredTemplates.filter(
          (t) =>
            filter._company === undefined ||
            String(filter._company) === String(t._company)
        )
      )
    ),
  },
  Mailings: {},
  Groups: {},
  Users: {},
  Galleries: {},
}));
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({}));
jest.mock(
  '../../../packages/server/template/generate-preview.controller.js',
  () => ({})
);
jest.mock(
  '../../../packages/server/template/template-blocks.controller.js',
  () => ({})
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const templateController = require('../../../packages/server/template/template.controller.js');

const superAdmin = {
  id: 'alice',
  role: 'super_admin',
  isAdmin: true,
  group: { id: PLATFORM_GROUP },
  selectedGroup: { id: CLIENT_GROUP },
};
const companyAdmin = {
  id: 'erin',
  role: 'company_admin',
  isGroupAdmin: true,
  group: { id: CLIENT_GROUP },
};

function listAs(user, query = {}) {
  return new Promise((resolve) => {
    templateController.list(
      { user, query },
      { json: (payload) => resolve({ status: 200, body: payload }) },
      (err) => resolve({ status: err.status })
    );
  });
}

const names = ({ body }) => body.items.map((t) => t.name);

// Turned on by #1275 (super admins in the modules of their selected group)
describe.skip('the templates of the new-mailing screen, for a super admin', () => {
  it('are the templates of the group the screen passes', async () => {
    expect(names(await listAs(superAdmin, { groupId: CLIENT_GROUP }))).toEqual([
      'Client newsletter',
      'Client promo',
    ]);
  });

  it('refuses an invalid group id with a client error', async () => {
    expect((await listAs(superAdmin, { groupId: 'undefined' })).status).toBe(
      400
    );
  });
});

// Today's behaviour, which the change must keep.
describe('the template listing', () => {
  it('lists every group to a super admin when no group is named, for the global templates page', async () => {
    expect(names(await listAs(superAdmin))).toEqual([
      'Client newsletter',
      'Client promo',
      'Platform digest',
    ]);
  });

  it("lists a company admin's own group, whatever group the request names", async () => {
    expect(
      names(await listAs(companyAdmin, { groupId: PLATFORM_GROUP }))
    ).toEqual(['Client newsletter', 'Client promo']);
  });
});
