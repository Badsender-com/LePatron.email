'use strict';

const { Workspaces } = require('../common/models.common.js');
const mongoose = require('mongoose');
const groupService = require('../group/group.service.js');

module.exports = {
  createWorkspace,
  listWorkspace,
};

async function createWorkspace(workspaceParams) {
  const newWorkspace = await Workspaces.create({
    name: workspaceParams.name,
    description: workspaceParams.description,
    _company: workspaceParams.groupId,
    _users: workspaceParams.selectedUsers.map(user => user.id),
  });

  return newWorkspace;
}

async function listWorkspace({ id }) {
  const workspaces = await Workspaces.find({
    _company: mongoose.Types.ObjectId(id),
  }).populate({
    path: 'folders',
    populate: { path: 'childFolders' },
  });
  return workspaces;
}
