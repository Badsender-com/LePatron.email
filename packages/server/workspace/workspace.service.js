'use strict';

const { Workspaces } = require('../common/models.common.js');
const mongoose = require('mongoose');

module.exports = {
  findByName,
  createWorkspace,
  listWorkspace,
};

async function findByName(workspaceName){
  return Workspaces.findOne({name: workspaceName});
}

async function createWorkspace(workspaceParams) {
  const newWorkspace = await Workspaces.create({
    name: workspaceParams.name,
    description: workspaceParams.description,
    _company: workspaceParams.groupId,
    _users: (workspaceParams.selectedUsers && workspaceParams.selectedUsers.map(user => user.id)) || [],
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

