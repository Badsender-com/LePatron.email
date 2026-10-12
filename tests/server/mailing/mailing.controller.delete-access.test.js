'use strict';

// Deleting a mailing: a mailing of another company answers like one that does
// not exist, and nothing is touched, its tags included, before every check has
// passed.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: { findOne: jest.fn(), releaseTags: jest.fn() },
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
  Mailings.findOne.mockResolvedValue({
    _id: MAILING_ID,
    _company: 'company-b',
    _workspace: WORKSPACE,
    tags: ['launch'],
  });
});

it("looks the mailing up within the user's company", async () => {
  Mailings.findOne.mockResolvedValue(null);

  expect((await remove()).status).toBe(200);
  expect(Mailings.findOne.mock.calls[0][0]).toMatchObject({
    _id: MAILING_ID,
    _company: 'company-b',
  });
  expect(mailingService.deleteMailing).not.toHaveBeenCalled();
  expect(Mailings.releaseTags).not.toHaveBeenCalled();
});

it('touches nothing when the user may not edit the mailing', async () => {
  mailingService.assertUserCanEditMailing.mockRejectedValue(new Forbidden());

  expect((await remove()).status).toBe(403);
  expect(Mailings.releaseTags).not.toHaveBeenCalled();
  expect(mailingService.deleteMailing).not.toHaveBeenCalled();
});

it('keeps the tags when the service refuses the deletion', async () => {
  mailingService.assertUserCanEditMailing.mockResolvedValue();
  mailingService.deleteMailing.mockRejectedValue(new Forbidden());

  expect((await remove()).status).toBe(403);
  expect(Mailings.releaseTags).not.toHaveBeenCalled();
});

it('deletes, then releases the tags, when every check passes', async () => {
  mailingService.assertUserCanEditMailing.mockResolvedValue();
  mailingService.deleteMailing.mockResolvedValue();

  expect((await remove()).status).toBe(200);
  expect(Mailings.releaseTags).toHaveBeenCalledWith('company-b', ['launch']);
});
