'use strict';

const asyncHandler = require('express-async-handler');

const { listFolders } = require('./folder.service');
module.exports = {
  list: asyncHandler(list),
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
  const folders = await listFolders();
  res.json({
    items: folders,
  });
}
