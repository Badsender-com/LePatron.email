'use strict';

const asyncHandler = require('express-async-handler');

const { listFolders } = require('./folder.service');
module.exports = {
  list: asyncHandler(list),
};

/**
 * @api {get} /folders list of folders
 * @apiPermission group_admin
 * @apiName getFolders
 * @apiGroup Folders
 *
 * @apiUse folders
 * @apiSuccess {folders[]} items list of folder
 */

async function list(req, res) {
  const folders = await listFolders();
  res.json({
    items: folders,
  });
}
