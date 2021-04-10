'use strict';

const { Folders } = require('../common/models.common.js');
const mongoose = require('mongoose');

const {
  NotFound,
  BadRequest,
  Conflict,
  NotAcceptable,
  InternalServerError,
  UnprocessableEntity,
} = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');

const workspaceService = require('../workspace/workspace.service.js');

module.exports = {
  listFolders,
  hasAccess,
  create,
  rename,
  getFolder,
  getWorkspaceForFolder,
  deleteFolder,
  move,
};

async function listFolders() {
  return Folders.find({}).populate('_parentFolder');
}

async function hasAccess(folderId, user) {
  const workspace = await getWorkspaceForFolder(folderId);

  return (
    workspaceService.isWorkspaceInGroup(workspace, user?.group?.id) &&
    workspaceService.isUserWorkspaceMember(user, workspace)
  );
}

async function getWorkspaceForFolder(folderId) {
  const folder = await getFolder(folderId);
  if (!folder) {
    throw new NotFound(ERROR_CODES.FOLDER_NOT_FOUND);
  }

  if (folder?._workspace) {
    return workspaceService.getWorkspace(folder?._workspace);
  }

  if (!folder?._parentFolder) {
    return null;
  }

  return getWorkspaceForFolder(folder?._parentFolder);
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
    const workspace = await workspaceService.getWorkspace(
      parentFolder._workspace
    );
    workspaceService.doesUserHaveWriteAccess(user, workspace);

    newFolder._parentFolder = parentFolder._id;
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

function getOnlyWorkspaceOrParentFolderParam({ _workspace, _parentFolder }) {
  if (_workspace) {
    return { _workspace };
  }

  if (_parentFolder) {
    return { _parentFolder };
  }
}

async function getFolder(folderId) {
  if (!(await Folders.exists({ _id: mongoose.Types.ObjectId(folderId) }))) {
    throw new NotFound(ERROR_CODES.FOLDER_NOT_FOUND);
  }

  return Folders.findOne({ _id: mongoose.Types.ObjectId(folderId) })
    .populate({
      path: 'childFolders',
    })
    .populate({
      path: 'mails',
    });
}

async function deleteFolder(user, folderId) {
  if (!(await Folders.exists({ _id: mongoose.Types.ObjectId(folderId) }))) {
    throw new NotFound(ERROR_CODES.FOLDER_NOT_FOUND);
  }
  if (await hasAccess(folderId, user)) {
    await workspaceService.deleteFolderContent(folderId);

    const deleteResponse = await Folders.deleteOne({
      _id: mongoose.Types.ObjectId(folderId),
    });

    if (deleteResponse.ok !== 1) {
      throw new InternalServerError(ERROR_CODES.FAILED_FOLDER_DELETE);
    }
  }
}

async function isNameUniqueAtSameLevel(folder) {
  const folders = await Folders.find({
    ...folder,
  });

  if (folders.length) {
    throw new Conflict(
      `${ERROR_CODES.NAME_ALREADY_TAKEN_AT_SAME_LEVEL} : ${folder.name}`
    );
  }
}

async function isNameTakenInDestination(destination, folderName) {
  const { workspaceId, destinationFolderId } = destination;

  const destinationFilter = destinationFolderId
    ? { _parentFolder: destinationFolderId }
    : { _workspace: workspaceId };

  return Folders.exists({
    ...destinationFilter,
    name: folderName,
  });
}

async function move(folderId, destination, user) {
  const { workspaceId, destinationFolderId } = destination;
  checkEitherWorkspaceOrFolderDefined(workspaceId, destinationFolderId);

  await hasAccess(folderId, user);

  const folder = await getFolder(folderId);

  if (!folder.name) {
    throw new UnprocessableEntity(ERROR_CODES.FOLDER_MISSING_NAME);
  }

  // moving to another folder
  if (destinationFolderId) {
    await hasAccess(destinationFolderId, user);

    // if moving to another folder, destination can't be a subfolder
    await checkIsSubfolder(destinationFolderId);

    // folder being moved can't have children, otherwise it becomes a sub-subfolder
    await checkIsParent(folderId);

    if (await isNameTakenInDestination({ destinationFolderId }, folder.name)) {
      throw new Conflict(
        `${ERROR_CODES.NAME_ALREADY_TAKEN_AT_SAME_LEVEL} : ${folder.name}`
      );
    }

    const moveToFolder = await Folders.updateOne(
      { _id: mongoose.Types.ObjectId(folderId) },
      {
        _parentFolder: mongoose.Types.ObjectId(destinationFolderId),
        $unset: { _workspace: '' },
      }
    );

    if (moveToFolder.ok !== 1) {
      throw new InternalServerError(ERROR_CODES.FAILED_FOLDER_MOVE);
    }

    return;
  }

  // moving to a workspace
  if (workspaceId) {
    const workspace = await workspaceService.getWorkspace(workspaceId);
    workspaceService.doesUserHaveWriteAccess(user, workspace);

    if (await isNameTakenInDestination({ workspaceId }, folder.name)) {
      throw new Conflict(
        `${ERROR_CODES.NAME_ALREADY_TAKEN_AT_SAME_LEVEL} : ${folder.name}`
      );
    }

    const moveToWorkspace = await Folders.updateOne(
      { _id: mongoose.Types.ObjectId(folderId) },
      {
        _workspace: mongoose.Types.ObjectId(workspaceId),
        $unset: { _parentFolder: '' },
      }
    );

    if (moveToWorkspace.ok !== 1) {
      throw new InternalServerError(ERROR_CODES.FAILED_FOLDER_MOVE);
    }
  }
}

async function checkIsSubfolder(folderId) {
  const folder = await Folders.findOne({
    _id: mongoose.Types.ObjectId(folderId),
    _parentFolder: {
      $exists: true,
    },
  });

  if (folder) {
    throw new NotAcceptable(ERROR_CODES.PARENT_FOLDER_IS_SUBFOLDER);
  }
}

async function checkIsParent(folderId) {
  const children = await Folders.find({
    _parentFolder: mongoose.Types.ObjectId(folderId),
  });

  if (children.length) {
    throw new NotAcceptable(ERROR_CODES.FOLDER_HAS_CHILDREN);
  }
}

function checkEitherWorkspaceOrFolderDefined(workspaceId, parentFolderId) {
  if (!workspaceId && !parentFolderId) {
    throw new BadRequest(ERROR_CODES.PARENT_NOT_PROVIDED);
  }

  if (workspaceId && parentFolderId) {
    throw new BadRequest(ERROR_CODES.TWO_PARENTS_PROVIDED);
  }
}

async function rename({ folderName, folderId }, user) {
  if (!folderName || folderName === '') {
    throw new BadRequest(ERROR_CODES.NAME_NOT_PROVIDED);
  }

  await hasAccess(folderId, user);
  const folder = await getFolder(folderId);
  const workspaceOrParentFolderParam = await getOnlyWorkspaceOrParentFolderParam(
    folder
  );

  await isNameUniqueAtSameLevel({
    ...workspaceOrParentFolderParam,
    name: folderName,
  });

  const updateResponse = await Folders.updateOne(
    { _id: mongoose.Types.ObjectId(folderId) },
    { name: folderName }
  );

  if (updateResponse.ok !== 1) {
    throw new InternalServerError(ERROR_CODES.FAILED_MAILING_RENAME);
  }
}
