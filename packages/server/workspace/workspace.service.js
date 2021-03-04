'use strict';

const { Workspaces } = require('../common/models.common.js');
const mongoose = require('mongoose');

module.exports = {
  existsByNameInGroup,
  createWorkspaceInGroup,
  findByGroupId,
};

async function existsByNameInGroup(workspaceParams) {
  return Workspaces.exists({
      name: workspaceParams.workspaceName,
      _company: workspaceParams.groupId
    });
}

async function createWorkspaceInGroup(workspaceParams) {
  const newWorkspace = await Workspaces.create({
    name: workspaceParams.name,
    description: workspaceParams.description || '',
    _company: workspaceParams.groupId,
    _users:
      (workspaceParams.selectedUsers &&
        workspaceParams.selectedUsers.map((user) => user.id)) ||
      [],
  });

  return newWorkspace;
}

async function findByGroupId(groupId) {
  const workspaces = await Workspaces.find({
    _company: mongoose.Types.ObjectId(groupId),
  }).populate({
    path: 'folders',
    populate: { path: 'childFolders' },
  });
  return workspaces;
}
