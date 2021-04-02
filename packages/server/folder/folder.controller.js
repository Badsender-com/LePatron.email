'use strict';

const asyncHandler = require('express-async-handler');

const folderService = require('./folder.service');
const workspaceService = require('../workspace/workspace.service.js');

module.exports = {
  list: asyncHandler(list),
  hasAccess: asyncHandler(hasAccess),
  create: asyncHandler(create),
  getFolder: asyncHandler(getFolder),
  deleteFolder: asyncHandler(deleteFolder),
  rename: asyncHandler(rename),
  move: asyncHandler(move)
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
  const {
    user,
    params: { folderId },
  } = req;

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
    body: { name, workspaceId, parentFolderId },
  } = req;

  const folder = {
    name,
    workspaceId,
    parentFolderId,
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

  const workspace = await folderService.getWorkspaceForFolder(folderId);
  workspaceService.doesUserHaveReadAccess(user, workspace);

  res.json(folder);
}

/**
 * @api {get} /folders/:folderId folder
 * @apiPermission user
 * @apiName PatchFolder
 * @apiGroup Folders
 *
 * @apiParam {string} folderId
 *
 * @apiParam (Body) {String} folderName
 *
 * @apiUse folder
 * @apiSuccess {folder} folder renamed
 */

async function rename(req, res) {
  const {
    user,
    params: { folderId },
    body: { folderName },
  } = req;

  await folderService.rename({ folderId, folderName }, user);

  res.status(204).send();
}

/**
 * @api {delete} /folders/:folderId folder delete
 * @apiPermission regular_user
 * @apiName DeleteFolder
 * @apiGroup Folders
 *
 * @apiUse folder
 * @apiSuccess {folder} folder deleted
 */

async function deleteFolder(req, res) {
  const {
    user,
    params: { folderId },
  } = req;

  await folderService.deleteFolder(user, folderId);

  res.status(204).send();
}

/**
 * @api {post} /folders/:folderId/move move folder from its source to a destination
 * @apiPermission regular_user
 * @apiName MoveFolder
 * @apiGroup Folders
 *
 * @apiParam {string} folderId
 *
 * @apiParam (Body) {String} workspaceId
 * @apiParam (Body) {String} destinationFolderId
 *
 * @apiUse folders
 */

async function move(req, res) {
  const {
    user,
    params: { folderId },
    body: { workspaceId, destinationFolderId },
  } = req;

  await folderService.move(folderId, { workspaceId, destinationFolderId }, user);

  res.status(204).send();
}
