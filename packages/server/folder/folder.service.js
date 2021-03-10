'use strict';

const { Folders, Mailings } = require('../common/models.common.js');

module.exports = {
  listFolders,
  deleteFolderContains,
};

async function listFolders() {
  const folders = await Folders.find({}).populate('_parentFolder');
  return folders;
}

async function deleteFolderContains(folderId) {
  const folderContains = Folders.find({ _parentFolder: folderId });
  if (folderContains && folderContains.length > 0) {
    folderContains.forEach((folder) => deleteFolderContains(folder?.id));
    await Mailings.deleteMany({ _parentFolder: folderId });
    await Folders.deleteMany({ _parentFolder: folderId });
  }
}
