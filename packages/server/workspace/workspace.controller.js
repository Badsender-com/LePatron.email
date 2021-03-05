'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const mongoose = require('mongoose');

const {
  createWorkspace,
  listWorkspaceForGroupAdmin,
  listWorkspaceForRegularUser,
} = require('./workspace.service');

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

async function list(req, res, next) {
  if (!req?.user) {
    next(new createError.Unauthorized());
  }
  let workspaces = null;
  if (req.user.isAdmin || req.user.isGroupAdmin) {
    workspaces = await listWorkspaceForGroupAdmin({
      _company: mongoose.Types.ObjectId(req.user._company?.id),
    });
  } else {
    workspaces = await listWorkspaceForRegularUser(req.user);
  }
  return res.json({ items: workspaces });
}
