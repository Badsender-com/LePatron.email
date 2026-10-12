'use strict';

// Deleting a mailing: nothing is touched, its tags included, before the user
// is known to have the right to edit it.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: { findById: jest.fn(), removeTagsFromEmail: jest.fn() },
  Templates: {},
  Galleries: {},
  Users: {},
}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  assertUserCanEditMailing: jest.fn(),
  deleteMailing: jest.fn(),
}));
jest.mock(
  '../../../packages/server/mailing/send-test-mail.controller.js',
  () => ({})
);
jest.mock(
  '../../../packages/server/mailing/download-zip.controller.js',
  () => ({})
);
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { Forbidden } = require('http-errors');
const {
  Mailings,
} = require('../../../packages/server/common/models.common.js');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const controller = require('../../../packages/server/mailing/mailing.controller.js');

const MAILING_ID = '507f1f77bcf86cd799439041';
const WORKSPACE = '507f1f77bcf86cd799439011';
const user = { id: 'u1', group: { id: 'company-b' } };

function remove() {
  return new Promise((resolve) => {
    const res = { send: () => resolve({ status: 200 }) };
    controller.delete(
      {
        user,
        params: { mailingId: MAILING_ID },
        body: { workspaceId: WORKSPACE },
      },
      res,
      (err) => resolve({ status: err.status })
    );
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  Mailings.findById.mockResolvedValue({
    _id: MAILING_ID,
    _workspace: WORKSPACE,
    tags: ['launch'],
  });
});

it('touches nothing when the user may not edit the mailing', async () => {
  mailingService.assertUserCanEditMailing.mockRejectedValue(new Forbidden());

  expect((await remove()).status).toBe(403);
  expect(Mailings.removeTagsFromEmail).not.toHaveBeenCalled();
  expect(mailingService.deleteMailing).not.toHaveBeenCalled();
});

it('removes the tags and deletes when the user may edit it', async () => {
  mailingService.assertUserCanEditMailing.mockResolvedValue();

  expect((await remove()).status).toBe(200);
  expect(Mailings.removeTagsFromEmail).toHaveBeenCalledWith(MAILING_ID, [
    'launch',
  ]);
  expect(mailingService.deleteMailing).toHaveBeenCalled();
});
