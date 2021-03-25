'use strict';

const asyncHandler = require('express-async-handler');

const folderService = require('./folder.service');

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

/**
 * @api {post} /folders folder creation
 * @apiPermission user
 * @apiName CreateFolder
 * @apiGroup Folders
 *
 * @apiParam (Body) {String} name
 * @apiParam (Body) {String} workspaceId
 * @apiParam (Body) {String} parentFolderId
 *
 * @apiUse folder
 * @apiSuccess {folder} created folder
 */
async function create(req, res) {
  const {
    user,
    body: { name, workspaceId, parentFolderId }
  } = req;

  const folder = {
    name,
    workspaceId,
    parentFolderId
  };

  const createdFolder = await folderService.create(folder, user);

  res.send(createdFolder);
}

