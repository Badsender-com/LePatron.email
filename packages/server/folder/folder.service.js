'use strict';

const { Folders } = require('../common/models.common.js');

module.exports = {
  listFolders,
};

async function listFolders() {
  const folders = await Folders.find({}).populate('_parentFolder');
  return folders;
}
