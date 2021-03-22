'use strict';

const { Folders, Mailings } = require('../common/models.common.js');

module.exports = {
  listFolders,
  deleteFolderContent,
};

async function listFolders() {
  const folders = await Folders.find({}).populate('_parentFolder');
  return folders;
}

async function deleteFolderContent(folderId) {
  const folderContent = await Folders.find({ _parentFolder: folderId });
  if (folderContent && folderContent.length > 0) {
    folderContent.forEach((folder) => {
      deleteFolderContent(folder?.id);
    });
  }
  await Mailings.deleteMany({ _parentFolder: folderId });
  await Folders.deleteMany({ _parentFolder: folderId });
}
