'use strict';

const asyncHandler = require('express-async-handler');
const workspaceService = require('./workspace.service');

module.exports = {
  existsByNameInGroup: asyncHandler(existsByNameInGroup),
  findByGroupIdOfCurrentUser: asyncHandler(findByGroupIdOfCurrentUser),
  createWorkspaceInGroup: asyncHandler(createWorkspaceInGroup),
};

/**
 * @api {get} /workspaces workspace
 * @apiPermission group_admin
 * @apiName GetWorkspace
 * @apiGroup Workspaces
 *
 * @apiParam {string} workspaceId
 *
 * @apiUse workspace
 */
async function existsByNameInGroup(req, res) {
  const { workspaceName } = req.params;
  const groupId = req.user._company.id;
  const workspaceExists = await workspaceService.existsByNameInGroup({ workspaceName, groupId });
  res.json(workspaceExists);
}

/**
 * @api {get} /workspace list of workspaces with folders
 * @apiPermission group_admin
 * @apiName GetWorkspaces
 * @apiGroup Workspaces
 *
 * @apiUse workspace
 * @apiSuccess {workspace[]} items list of workspace
 */
async function findByGroupIdOfCurrentUser(req, res) {
  const workspaces = await workspaceService.findByGroupId(req.user._company.id);
  res.json({ items: workspaces });
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
  const newWorkspace = await workspaceService.createWorkspaceInGroup(req.body);
  res.json(newWorkspace);
}
