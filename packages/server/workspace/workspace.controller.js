'use strict';

const asyncHandler = require('express-async-handler');
const { default: createHttpError } = require('http-errors');

const {
  createWorkspace,
  listWorkspaceForGroupAdmin,
  listWorkspaceForRegularUser,
} = require('./workspace.service');

module.exports = {
  list: asyncHandler(list),
  createWorkspace: asyncHandler(createWorkspaceInGroup),
};

/**
 * @api {get} /workspace list of workspaces with folders
 * @apiPermission group_admin
 * @apiName GetWorkspaces
 * @apiGroup Workspaces
 *
 * @apiUse workspace
 * @apiSuccess {workspace[]} items list of workspace
 */

async function list(req, res, next) {
  if (!req?.user) {
    next(new createHttpError.Unauthorized());
  }
  let workspaces = null;
  const user = req.user;
  if (user?.isGroupAdmin) {
    const { group } = user;
    workspaces = await listWorkspaceForGroupAdmin(group.id);
  } else {
    workspaces = await listWorkspaceForRegularUser(req.user);
  }
  return res.json({ workspaces });
}

/**
 * @api {post} /workspaces workspace creation
 * @apiPermission group_admin
 * @apiName CreateWorkspace
 * @apiGroup Workspaces
 *
 * @apiParam (Body) {String} groupId the group of the workspace
 * @apiParam (Body) {String} email should be unique in the application
 * @apiParam (Body) {String} [name]
 * @apiParam (Body) {String} [description]
 * @apiParam (Body) {Array} [userIds] Ids of the workspace's members
 *
 * @apiUse workspace
 * @apiSuccess {workspace} workspace created
 */

async function createWorkspaceInGroup(req, res) {
  const newWorkspace = await createWorkspace(req.body);
  res.json(newWorkspace);
}
