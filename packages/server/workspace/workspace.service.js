'use strict';

const { Workspaces, Mailings, Folders } = require('../common/models.common.js');
const mongoose = require('mongoose');
const folderService = require('../folder/folder.service');
const ERROR_CODES = require('../constant/error-codes.js');
const { Conflict, NotFound, Forbidden } = require('http-errors');

module.exports = {
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspace,
  findWorkspaces,
  findWorkspacesWithRights,
  getWorkspaceWithAccessRight,
  workspaceContainsUser,
  doesUserHaveWriteAccess
};

async function existsByName({ workspaceId, workspaceName, groupId }) {
  return Workspaces.exists({
    _id: { $ne: mongoose.Types.ObjectId(workspaceId)},
    name: workspaceName,
    _company: groupId,
  });
}

async function getWorkspace(id) {
  if (!(await Workspaces.exists({ _id: mongoose.Types.ObjectId(id) }))) {
    throw new NotFound(ERROR_CODES.WORKSPACE_NOT_FOUND);
  }
  return Workspaces.findById(id);
}

async function getWorkspaceWithAccessRight(id, user) {
  const workspace = await getWorkspace(id);

  let workspaceWithAccess = {
    ...workspace?.toObject(),
    hasAccess: false,
  };

  if (
    user.isGroupAdmin ||
    (!user.isGroupAdmin && workspaceContainsUser(workspaceWithAccess, user))
  ) {
    workspaceWithAccess = {
      ...workspaceWithAccess,
      hasAccess: true,
    };
  }

  return workspaceWithAccess;
}

async function deleteWorkspace(workspaceId) {
  return Workspaces.deleteOne({ _id: workspaceId }, async () => {
    await Mailings.deleteMany({ _workspace: workspaceId });
    const foldersToDelete = await Folders.find({ _workspace: workspaceId });
    if (foldersToDelete && foldersToDelete.length > 0) {
      foldersToDelete?.forEach((folder) =>
        folderService.deleteFolderContent(folder?.id)
      );
    }
    await Folders.deleteMany({ _workspace: workspaceId });
  });
}

async function createWorkspace(workspace) {
  if (
    await existsByName({
      workspaceName: workspace?.name,
      groupId: workspace?.groupId,
    })
  ) {
    throw new Conflict(ERROR_CODES.WORKSPACE_ALREADY_EXISTS);
  }
  const newWorkspace = await Workspaces.create({
    name: workspace.name,
    description: workspace.description || '',
    _company: workspace.groupId,
    _users:
      (workspace.selectedUsers &&
        workspace.selectedUsers.map((user) => user.id)) ||
      [],
  });

  return newWorkspace;
}

async function updateWorkspace(workspace) {
  if (
    await existsByName({
      workspaceId: workspace.id,
      workspaceName: workspace?.name,
      groupId: workspace?.groupId,
    })
  ) {
    throw new Conflict(ERROR_CODES.WORKSPACE_ALREADY_EXISTS);
  }

  const { id, ...otherProperties } = workspace;

  return Workspaces.updateOne(
    { _id: mongoose.Types.ObjectId(id) },
    { ...otherProperties }
  );
}

async function findWorkspaces({ groupId }) {
  const workspaces = await Workspaces.find({ _company: groupId })
    .populate({
      path: 'users',
    })
    .populate({
      path: 'folders',
      populate: { path: 'childFolders' },
    })
    .populate({
      path: 'mails',
    });
  return workspaces;
}

async function findWorkspacesWithRights({ groupId, userId, isGroupAdmin }) {
  const workspaces = await findWorkspaces({ groupId });

  let workspacesWithRights = workspaces?.map((workspace) => ({
    ...workspace.toObject(),
    hasRights: true,
  }));

  if (!isGroupAdmin) {
    workspacesWithRights = workspacesWithRights.map((workspace) => {
      if (!workspace._users?.toString().includes(userId)) {
        return {
          ...workspace,
          hasRights: false,
        };
      }
      return workspace;
    });
  }

  return workspacesWithRights.sort(
    (a, b) => b.hasRights - a.hasRights || a.name?.localeCompare(b.name)
  );
}

function isWorkspaceInGroup(workspace, groupId) {
  return workspace?.group.toString() === groupId;
}

function workspaceContainsUser(workspace, user) {
  return workspace._users?.toString().includes(user.id);
}

function isUserWorkspaceMember(user, workspace) {
  if (user.isGroupAdmin) {
    return true;
  }
  return workspaceContainsUser(workspace, user);
}

function doesUserHaveWriteAccess(user, workspace) {
  if(!isWorkspaceInGroup(workspace, user.group.id)) {
    throw new NotFound(`${ERROR_CODES.WORKSPACE_NOT_FOUND} : ${workspace.name}`);
  }

  if(!isUserWorkspaceMember(user, workspace) ){
    throw new Forbidden(ERROR_CODES.FORBIDDEN_MAILING_MOVE);
  }
}
