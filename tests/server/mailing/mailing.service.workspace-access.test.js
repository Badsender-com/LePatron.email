'use strict';

// Creating or deleting a mailing in a workspace needs the right to write in
// it: the workspace check throws, so the mailing is never created nor deleted.

jest.mock('../../../packages/server/common/models.common', () => ({
  Mailings: { findOne: jest.fn(), create: jest.fn(), deleteOne: jest.fn() },
  Galleries: {},
  Groups: {},
  Workspaces: {},
  Folders: {},
  Tags: {},
  Users: {},
  Templates: {},
}));
jest.mock('../../../packages/server/workspace/workspace.service.js', () => ({
  assertAccess: jest.fn(),
}));
jest.mock('../../../packages/server/folder/folder.service.js', () => ({
  hasAccess: jest.fn(),
}));
jest.mock('../../../packages/server/template/template.service.js', () => ({
  findOne: jest.fn(),
  doesUserHaveAccess: jest.fn(),
}));
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { NotFound } = require('http-errors');
const { Mailings } = require('../../../packages/server/common/models.common');
const workspaceService = require('../../../packages/server/workspace/workspace.service.js');
const templateService = require('../../../packages/server/template/template.service.js');
const mailingService = require('../../../packages/server/mailing/mailing.service');

const WORKSPACE = '507f1f77bcf86cd799439011';
const MAILING = '507f1f77bcf86cd799439041';
const user = { id: 'u1', name: 'Someone', group: { id: 'company-b' } };

beforeEach(() => {
  jest.clearAllMocks();
  workspaceService.assertAccess.mockRejectedValue(new NotFound());
  templateService.findOne.mockResolvedValue({ _id: 't1', name: 'Template' });
  templateService.doesUserHaveAccess.mockResolvedValue();
});

const create = () =>
  mailingService.createInsideWorkspaceOrFolder({
    templateId: '507f1f77bcf86cd799439021',
    mailingName: 'Newsletter',
    workspaceId: WORKSPACE,
    user,
  });

it('creates nothing from a template of another company', async () => {
  workspaceService.assertAccess.mockResolvedValue();
  templateService.doesUserHaveAccess.mockRejectedValue(new NotFound());

  await expect(create()).rejects.toMatchObject({ status: 404 });
  expect(Mailings.create).not.toHaveBeenCalled();
});

it('creates nothing from a template that does not exist', async () => {
  workspaceService.assertAccess.mockResolvedValue();
  templateService.findOne.mockResolvedValue(null);

  await expect(create()).rejects.toMatchObject({ status: 404 });
  expect(Mailings.create).not.toHaveBeenCalled();
});

it('creates nothing in a workspace the user may not write in', async () => {
  await expect(
    mailingService.createInsideWorkspaceOrFolder({
      templateId: '507f1f77bcf86cd799439021',
      mailingName: 'Newsletter',
      workspaceId: WORKSPACE,
      user,
    })
  ).rejects.toMatchObject({ status: 404 });
  expect(Mailings.create).not.toHaveBeenCalled();
});

it('deletes nothing in a workspace the user may not write in', async () => {
  await expect(
    mailingService.deleteMailing({
      mailingId: MAILING,
      workspaceId: WORKSPACE,
      user,
    })
  ).rejects.toMatchObject({ status: 404 });
  expect(Mailings.deleteOne).not.toHaveBeenCalled();
});
