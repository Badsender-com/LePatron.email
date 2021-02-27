'use strict';

const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
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
  const workspace = req.user._company;
  const workspaces = await Workspaces.find({
    _company: mongoose.Types.ObjectId(workspace.id),
  }).populate({
    path: 'folders',
    populate: { path: 'childFolders' },
  });

  res.json({ items: workspaces });
}
