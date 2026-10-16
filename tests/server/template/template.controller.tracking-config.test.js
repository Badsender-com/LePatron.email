'use strict';

// A template's tracking settings: a company's tech admin edits its own
// company's templates only, a super admin any template.

const mongoose = require('mongoose');

const CLIENT_GROUP = '507f1f77bcf86cd799439b01';

const mockTemplate = {
  _id: '507f1f77bcf86cd799439d01',
  _company: new mongoose.Types.ObjectId(CLIENT_GROUP),
  save: jest.fn(),
};

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Templates: { findById: jest.fn(() => Promise.resolve(mockTemplate)) },
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
const {
  PLATFORM_GROUP,
  actorFrom,
  call,
} = require('../../helpers/super-admin-fixtures.js');

const techAdminOf = (groupId) =>
  actorFrom({
    _id: '507f1f77bcf86cd799439114',
    name: 'Tess',
    role: 'company_admin_tech',
    _company: groupId,
  });
const superAdmin = actorFrom({
  _id: '507f1f77bcf86cd799439101',
  name: 'Alice',
  role: 'super_admin',
  _company: PLATFORM_GROUP,
});

const update = (user) =>
  call(templateController.updateTrackingConfig, {
    user,
    params: { templateId: mockTemplate._id },
    body: {},
  });

beforeEach(() => jest.clearAllMocks());

it.each([
  ['a super admin', superAdmin],
  ["a tech admin of the template's company", techAdminOf(CLIENT_GROUP)],
])('lets %s edit it', async (_label, user) => {
  const result = await update(user);

  expect(result.status).toBe(200);
  expect(mockTemplate.save).toHaveBeenCalledTimes(1);
});

it('refuses a tech admin of another company', async () => {
  const result = await update(techAdminOf(PLATFORM_GROUP));

  expect(result.status).toBe(403);
  expect(mockTemplate.save).not.toHaveBeenCalled();
});
