'use strict';

const { Folders, Mailings } = require('../common/models.common.js');
const mongoose = require('mongoose');
const { NotFound, BadRequest } = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');

const workspaceService = require('../workspace/workspace.service.js');

module.exports = {
  listFolders,
  deleteFolderContent,
  create
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

async function create(folder, user) {
  const { workspaceId, parentFolderId, name } = folder;

  if (!name || name === '') {
    throw new BadRequest(ERROR_CODES.NAME_NOT_PROVIDED);
  }

  if (!workspaceId && !parentFolderId) {
    throw new BadRequest(ERROR_CODES.PARENT_NOT_PROVIDED);
  }

  if (workspaceId && parentFolderId) {
    throw new BadRequest(ERROR_CODES.TWO_PARENTS_PROVIDED);
  }

  if (workspaceId) {
    const workspace = await workspaceService.getWorkspace(workspaceId);

    if (!workspace) {
      throw new NotFound(ERROR_CODES.WORKSPACE_NOT_FOUND);
    }

    workspaceService.doesUserHaveWriteAccess(user, workspace);

    folder._workspace = workspace._id;
  }

  if (parentFolderId) {
    const parentFolder = await getFolder(parentFolderId);

    if (!parentFolder) {
      throw new NotFound(ERROR_CODES.FOLDER_NOT_FOUND);
    }

    workspaceService.doesUserHaveWriteAccess(user, parentFolder._workspace);

    folder._parentFolder = parentFolder._id;
    folder._workspace = parentFolder._workspace;
  }

  return Folders.create(folder);

}

async function getFolder(folderId) {
  return Folders.findOne({ _id : mongoose.Types.ObjectId(folderId)})
}
