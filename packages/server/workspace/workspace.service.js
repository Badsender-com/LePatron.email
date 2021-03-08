'use strict';

const { Workspaces } = require('../common/models.common.js');
const mongoose = require('mongoose');
const ERROR_CODES = require('../constant/error-codes.js')
const { Conflict } = require('http-errors');

module.exports = {
  createWorkspace,
  listWorkspace,
  listWorkspaceForRegularUser,
  listWorkspaceForGroupAdmin,
};

async function existsByName({ workspaceName, groupId }) {
  return Workspaces.exists({
    name: workspaceName,
    _company: groupId,
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

async function listWorkspace(params) {
  const workspaces = await Workspaces.find(params).populate({
    path: 'folders',
    populate: { path: 'childFolders' },
  });
  return workspaces;
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
