'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');

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
 * @apiUse folders
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

  const createdFolder = await folderService.create(folder);


}

