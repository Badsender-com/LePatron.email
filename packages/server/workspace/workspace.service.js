'use strict';

const { Workspaces, Mailings, Folders } = require('../common/models.common.js');
const mongoose = require('mongoose');
const ERROR_CODES = require('../constant/error-codes.js');
const { Conflict, NotFound } = require('http-errors');

module.exports = {
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  listWorkspace,
  listWorkspaceWithUsers,
  listWorkspaceForRegularUser,
  listWorkspaceForGroupAdmin,
  findWorkspace,
  deleteWorkspace,
};

async function existsByName({ workspaceName, groupId }) {
  return Workspaces.exists({
    name: workspaceName,
    _company: groupId,
  });
}

async function findWorkspace(params) {
  return Workspaces.findOne(params);
}

async function deleteWorkspace(workspaceId) {
  return Workspaces.deleteOne({ _id: workspaceId }, async () => {
    await Mailings.deleteMany({ _workspace: workspaceId });
    await Folders.deleteMany({ _workspace: workspaceId });
  });
}

async function getWorkspace(id) {
  if (!(await Workspaces.exists({ _id: mongoose.Types.ObjectId(id) }))) {
    throw new NotFound();
  }
  return Workspaces.findById(id);
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
  const { id, ...otherProperties } = workspace;

  return Workspaces.updateOne(
    { _id: mongoose.Types.ObjectId(id) },
    { ...otherProperties }
  );
}

async function listWorkspace(params) {
  const workspaces = await Workspaces.find(params).populate({
    path: 'folders',
    populate: { path: 'childFolders' },
  });
  return workspaces;
}

async function listWorkspaceWithUsers(params) {
  return Workspaces.find(params).populate({
    path: 'users',
  });
}

async function listWorkspaceForGroupAdmin(groupId) {
  const listWorkspacesForGroupAdmin = await listWorkspace({
    _company: mongoose.Types.ObjectId(groupId),
  });

  return listWorkspacesForGroupAdmin?.map((workSpace) => {
    return { ...workSpace.toObject(), hasRights: true };
  });
}

async function listWorkspaceForRegularUser(user) {
  const promiseListWorkspaceForNotGroupUser = listWorkspace({
    _company: mongoose.Types.ObjectId(user._company?.id),
    _users: { $ne: user.id },
  });
  const promiseListWorkspaceForGroupUser = listWorkspace({
    _company: mongoose.Types.ObjectId(user._company?.id),
    _users: user.id,
  });
  const [otherWorkSpaces, workspacesForCurrentUser] = await Promise.all([
    promiseListWorkspaceForNotGroupUser,
    promiseListWorkspaceForGroupUser,
  ]);

  const formatWorkspacesForCurrentUser = workspacesForCurrentUser.map(
    (workSpace) => {
      return { ...workSpace.toObject(), hasRights: true };
    }
  );

  const formatOtherWorkSpaces = otherWorkSpaces.map((workSpace) => {
    return { ...workSpace.toObject(), hasRights: false };
  });

  return [...formatWorkspacesForCurrentUser, ...formatOtherWorkSpaces];
}
