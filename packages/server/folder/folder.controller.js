'use strict';

const asyncHandler = require('express-async-handler');

const folderService = require('./folder.service');
const workspaceService = require('../workspace/workspace.service.js');

module.exports = {
  list: asyncHandler(list),
  hasAccess: asyncHandler(hasAccess),
  create: asyncHandler(create),
  getFolder: asyncHandler(getFolder)
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
 * @api {get} /folders/:folderId/has-access check folder access
 * @apiPermission regular_user
 * @apiName GetFolderAccess
 * @apiGroup Folders
 *
 * @apiUse folder
 * @apiSuccess {hasAccess} boolean indicating access
 */
async function hasAccess(req, res) {
  const { user, params: { folderId } } = req;

  const hasAccess = await folderService.hasAccess(folderId, user);

  res.json({ hasAccess });
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

/**
 * @api {get} /folders/:folderId folder
 * @apiPermission user
 * @apiName GetFolder
 * @apiGroup Folders
 *
 * @apiUse folder
 * @apiSuccess {folder} folder
 */
async function getFolder(req, res) {
  const {
    user,
    params: { folderId },
  } = req;

  const folder = await folderService.getFolder(folderId);

  const workspace = await workspaceService.getWorkspace(folder._workspace);
  workspaceService.doesUserHaveReadAccess(user, workspace);

  res.json(folder)

}
