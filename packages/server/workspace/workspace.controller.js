'use strict';

const asyncHandler = require('express-async-handler');
const { createWorkspace, listWorkspace } = require('./workspace.service');

module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(createWorkspace),
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
