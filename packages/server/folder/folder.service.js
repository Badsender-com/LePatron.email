'use strict';

const { Folders, Mailings } = require('../common/models.common.js');
const mongoose = require('mongoose');

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

async function create(folder) {
  const { parentFolderId } = folder;
  if (parentFolderId) {
    const parentFolder = await getFolder(parentFolderId);

    if (parentFolder?._parentFolder) {
      throw new c
    }
  }
}

async function getFolder(folderId) {
  return Folders.findOne({ _id : mongoose.Types.ObjectId(folderId)})
}
