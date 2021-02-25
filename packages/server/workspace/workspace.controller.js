'use strict';

const asyncHandler = require('express-async-handler');

const { Workspaces } = require('../common/models.common.js');

module.exports = {
  list: asyncHandler(list),
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
  const workspaces = await Workspaces.find({}).populate({
    path: 'folders',
    populate: { path: '_parentFolder' },
  });
  res.json({ items: workspaces });
}
