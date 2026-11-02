'use strict';

// Reading or deleting a workspace by id: a super admin reaches every
// company's workspaces, anyone else its own company's (account/permissions.js).

const mongoose = require('mongoose');

jest.mock('../../../packages/server/workspace/workspace.service', () => ({
  getWorkspace: jest.fn(),
  getWorkspaceWithAccessRight: jest.fn(),
  deleteWorkspace: jest.fn(),
}));

const workspaceService = require('../../../packages/server/workspace/workspace.service');
const workspaceController = require('../../../packages/server/workspace/workspace.controller.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const {
  ALICE,
  DAVE,
  FRANK,
  CLIENT_GROUP,
  USERS,
  actorFrom,
  call,
} = require('../../helpers/super-admin-fixtures.js');

const actor = (id) => actorFrom(USERS.find((u) => u._id === id));
const WORKSPACE_ID = '507f1f77bcf86cd799439c01';
const WORKSPACE = {
  _id: WORKSPACE_ID,
  name: 'Newsletters',
  _company: new mongoose.Types.ObjectId(CLIENT_GROUP),
};

beforeEach(() => {
  jest.clearAllMocks();
  workspaceService.getWorkspace.mockResolvedValue(WORKSPACE);
  workspaceService.getWorkspaceWithAccessRight.mockResolvedValue(WORKSPACE);
  workspaceService.deleteWorkspace.mockResolvedValue();
});

const params = { workspaceId: WORKSPACE_ID };

describe('reading a workspace', () => {
  it.each([
    ['a super admin', actor(ALICE)],
    ['a member of its company', actor(FRANK)],
  ])('lets %s read it', async (_label, user) => {
    const result = await call(workspaceController.getWorkspace, {
      user,
      params,
    });
    expect(result).toEqual({ status: 200, body: WORKSPACE });
  });

  it('answers a member of another company as if it did not exist', async () => {
    const result = await call(workspaceController.getWorkspace, {
      user: actor(DAVE),
      params,
    });
    expect(result).toEqual({
      status: 404,
      body: ERROR_CODES.WORKSPACE_NOT_FOUND,
    });
  });
});

describe('deleting a workspace', () => {
  it.each([
    ['a super admin', actor(ALICE)],
    ['a member of its company', actor(FRANK)],
  ])('lets %s delete it', async (_label, user) => {
    const result = await call(workspaceController.deleteWorkspace, {
      user,
      params,
    });
    expect(result.status).toBe(204);
    expect(workspaceService.deleteWorkspace).toHaveBeenCalledWith(WORKSPACE_ID);
  });

  it('refuses a member of another company', async () => {
    const result = await call(workspaceController.deleteWorkspace, {
      user: actor(DAVE),
      params,
    });
    expect(result).toEqual({
      status: 403,
      body: ERROR_CODES.FORBIDDEN_WORKSPACE_RETRIEVAL,
    });
    expect(workspaceService.deleteWorkspace).not.toHaveBeenCalled();
  });
});
