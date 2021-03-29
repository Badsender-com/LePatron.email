'use strict';

const { Folders } = require('../common/models.common.js');
const mongoose = require('mongoose');
const { NotFound, BadRequest, Conflict, NotAcceptable } = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');

const workspaceService = require('../workspace/workspace.service.js');

module.exports = {
  listFolders,
  create,
  getFolder
};

async function listFolders() {
  return Folders.find({}).populate('_parentFolder');
}

async function create(folder, user) {
  checkCreationPayload(folder);

  const { workspaceId, parentFolderId, name } = folder;

  const newFolder = { name };

  // case where folder is added to workspace's root
  if (workspaceId) {

    const workspace = await workspaceService.getWorkspace(workspaceId);
    workspaceService.doesUserHaveWriteAccess(user, workspace);

    newFolder._workspace = workspace._id;
  }

  // case where folder is a subfolder
  if (parentFolderId) {
    const parentFolder = await getFolder(parentFolderId);

    if (parentFolder._parentFolder) {
      throw new NotAcceptable(ERROR_CODES.PARENT_FOLDER_IS_SUBFOLDER);
    }
    const workspace = await workspaceService.getWorkspace(parentFolder._workspace);
    workspaceService.doesUserHaveWriteAccess(user, workspace);

    newFolder._parentFolder = parentFolder._id;
    newFolder._workspace = parentFolder._workspace;
  }

  await isNameUniqueAtSameLevel(newFolder);

  return Folders.create(newFolder);
}

function checkCreationPayload(folder) {
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
}

async function getFolder(folderId) {
  if (!(await Folders.exists({ _id: mongoose.Types.ObjectId(folderId) }))) {
    throw new NotFound(ERROR_CODES.FOLDER_NOT_FOUND);
  }

  return Folders.findOne({ _id : mongoose.Types.ObjectId(folderId) });
}

async function isNameUniqueAtSameLevel(folder){
  const folders = await Folders.find({
    ...folder
  });

  if (folders.length) {
    throw new Conflict(`${ERROR_CODES.NAME_ALREADY_TAKEN_AT_SAME_LEVEL} : ${folder.name}`);
  }
}
