'use strict';

const asyncHandler = require('express-async-handler');
const { createWorkspace, listWorkspace } = require('./workspace.service');

module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(createWorkspace),
};

/**
 * @api {get} /workspace list of mailings
 * @apiPermission group_admin
 * @apiName getWorkspaces
 * @apiGroup workspaces
 *
 * @apiUse workspaces
 * @apiSuccess {workspace[]} items list of workspace
 */

async function list(req, res) {
  const workspaces = await listWorkspace(req.user._company);
  res.json({ items: workspaces });
}
