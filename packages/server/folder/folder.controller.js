'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');

const folderService = require('./folder.service');
const workspaceService = require('../workspace/workspace.service.js');

module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(create)
};

/**
 * @api {get} /folders list of folders
 * @apiPermission group_admin
 * @apiName GetFolders
 * @apiGroup Folders
 *
 * @apiUse folder
 * @apiSuccess {folders[]} items list of folders
 */

async function list(req, res) {
  const folders = await folderService.listFolders();
  res.json({
    items: folders,
  });
}

async function create(req, res) {
  const { user } = req;
  const { name, workspaceId, parentFolderId } = req.body;

  if (!workspaceId) {
    throw new createError.BadRequest(ERROR_CODES.WORKSPACE_ID_NOT_PROVIDED);
  }

  if (!name) {
    throw new createError.BadRequest(ERROR_CODES.NAME_NOT_PROVIDED)
  }

  const workspace = await workspaceService.getWorkspace(workspaceId);

  if (workspace?.group.toString() !== user.group.id) {
    throw new createError.NotFound(ERROR_CODES.WORKSPACE_NOT_FOUND);
  }

  if (!user.isGroupAdmin && !workspaceService.workspaceContainsUser(workspace, user)) {
    throw new createError.Forbidden(ERROR_CODES.FORBIDDEN_FOLDER_CREATION);
  }

  const createdFolder =


}
