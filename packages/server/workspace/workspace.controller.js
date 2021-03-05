'use strict';

const asyncHandler = require('express-async-handler');
const workspaceService = require('./workspace.service');

module.exports = {
  list: asyncHandler(list),
  findByGroupWithUserCount: asyncHandler(findByGroupWithUserCount)
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
  const workspaces = await workspaceService.listWorkspace(req.user._company);
  res.json({ items: workspaces });
}

async function findByGroupWithUserCount(req, res) {
  const workspaces = await workspaceService.findByGroupWithUserCount(req.params.groupId);
  res.json(workspaces)
}
