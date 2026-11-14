'use strict';

// Reading one template: a super admin reads any company's, anyone else their
// own company's only, like the markup route. Another company's template reads
// as not found.

const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';
const CLIENT_GROUP = '507f1f77bcf86cd799439b01';
const CLIENT_TEMPLATE = '507f1f77bcf86cd799439c01';
const PLATFORM_TEMPLATE = '507f1f77bcf86cd799439c02';

const mockStoredTemplates = [
  { _id: CLIENT_TEMPLATE, name: 'Client newsletter', _company: CLIENT_GROUP },
  { _id: PLATFORM_TEMPLATE, name: 'Platform digest', _company: PLATFORM_GROUP },
];

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Templates: {
    findOne: jest.fn((filter) => ({
      populate: () =>
        Promise.resolve(
          mockStoredTemplates.find(
            (t) =>
              String(t._id) === String(filter._id) &&
              (filter._company === undefined ||
                String(filter._company) === String(t._company))
          ) || null
        ),
    })),
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
  group: { id: PLATFORM_GROUP },
};
const companyAdmin = {
  id: 'erin',
  role: 'company_admin',
  group: { id: CLIENT_GROUP },
};

function readAs(user, templateId) {
  return new Promise((resolve) => {
    templateController.read(
      { user, params: { templateId } },
      { json: (payload) => resolve({ status: 200, body: payload }) },
      (err) => resolve({ status: err.status })
    );
  });
}

describe('reading one template', () => {
  it("gives a company admin their own company's template", async () => {
    const { status, body } = await readAs(companyAdmin, CLIENT_TEMPLATE);

    expect(status).toBe(200);
    expect(body.name).toBe('Client newsletter');
  });

  it("answers not found for another company's template", async () => {
    expect((await readAs(companyAdmin, PLATFORM_TEMPLATE)).status).toBe(404);
  });

  it("gives a super admin any company's template", async () => {
    expect((await readAs(superAdmin, CLIENT_TEMPLATE)).status).toBe(200);
  });

  it('answers not found for an id that is not one', async () => {
    expect((await readAs(companyAdmin, 'undefined')).status).toBe(404);
  });
});
