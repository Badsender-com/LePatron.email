'use strict';

const asyncHandler = require('express-async-handler');
const { createWorkspace, listWorkspace } = require('./workspace.service');

module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(create),
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

async function list(req, res) {
  const workspaces = await listWorkspace(req.user._company);
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

async function create(req, res) {
  const newWorkspace = await createWorkspace(req.body);
  res.json(newWorkspace);
}
